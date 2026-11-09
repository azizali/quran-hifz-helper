package com.azizali.quran

import android.content.ComponentName
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.common.util.concurrent.ListenableFuture

@CapacitorPlugin(name = "NativeQuranAudio")
class NativeQuranAudioPlugin : Plugin() {
    private var trackIds: List<String> = emptyList()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var attachedPlayer: ExoPlayer? = null
    private var lastIsPlaying: Boolean? = null

    private val positionRunnable = object : Runnable {
        override fun run() {
            emitPositionUpdate()
            mainHandler.postDelayed(this, POSITION_INTERVAL_MS)
        }
    }

    private val playerListener = object : Player.Listener {
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            val exoPlayer = attachedPlayer ?: return
            val index = exoPlayer.currentMediaItemIndex
            val trackId = trackIds.getOrNull(index) ?: return
            notifyListeners("trackChanged", JSObject().put("index", index).put("trackId", trackId))
            emitPositionUpdate()
        }

        override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) = syncPlaying()

        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_ENDED) {
                // Otherwise a later seek would resume playback on its own.
                attachedPlayer?.playWhenReady = false
                notifyListeners("queueEnded", JSObject())
            }
            syncPlaying()
            emitPositionUpdate()
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int
        ) = emitPositionUpdate()

        override fun onPlayerError(error: PlaybackException) {
            notifyListeners("playbackError", JSObject().put("message", error.message ?: "Playback failed"))
        }
    }

    // MediaController connects to (and thereby creates) the session service, so
    // the future resolving guarantees QuranPlaybackService.player exists.
    override fun load() {
        val token = SessionToken(context, ComponentName(context, QuranPlaybackService::class.java))
        controllerFuture = MediaController.Builder(context, token)
            .setApplicationLooper(Looper.getMainLooper())
            .buildAsync()
    }

    // Capacitor runs plugin methods on a background thread; ExoPlayer is main-thread only.
    private fun withPlayer(call: PluginCall, block: (ExoPlayer) -> Unit) {
        val future = controllerFuture ?: run {
            call.reject("Playback service not ready")
            return
        }
        future.addListener({
            val exoPlayer = QuranPlaybackService.player
            if (exoPlayer == null) {
                call.reject("Playback service not ready")
            } else {
                attachListener(exoPlayer)
                block(exoPlayer)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    private fun attachListener(exoPlayer: ExoPlayer) {
        if (attachedPlayer === exoPlayer) return
        attachedPlayer?.removeListener(playerListener)
        attachedPlayer = exoPlayer
        exoPlayer.addListener(playerListener)
    }

    private fun isEffectivelyPlaying(exoPlayer: ExoPlayer): Boolean {
        return exoPlayer.playWhenReady && exoPlayer.playbackState != Player.STATE_ENDED &&
            exoPlayer.playbackState != Player.STATE_IDLE
    }

    private fun syncPlaying() {
        val exoPlayer = attachedPlayer ?: return
        val isPlaying = isEffectivelyPlaying(exoPlayer)
        if (isPlaying == lastIsPlaying) return
        lastIsPlaying = isPlaying
        notifyListeners("playbackState", JSObject().put("isPlaying", isPlaying))
        mainHandler.removeCallbacks(positionRunnable)
        if (isPlaying) mainHandler.post(positionRunnable)
    }

    private fun statusObject(exoPlayer: ExoPlayer, trackId: String): JSObject {
        val duration = exoPlayer.duration.takeIf { it != C.TIME_UNSET } ?: 0L
        return JSObject()
            .put("index", exoPlayer.currentMediaItemIndex)
            .put("trackId", trackId)
            .put("positionSeconds", exoPlayer.currentPosition / 1000.0)
            .put("durationSeconds", duration / 1000.0)
    }

    private fun emitPositionUpdate() {
        val exoPlayer = attachedPlayer ?: return
        val trackId = trackIds.getOrNull(exoPlayer.currentMediaItemIndex) ?: return
        notifyListeners("positionUpdate", statusObject(exoPlayer, trackId))
    }

    @PluginMethod
    fun setQueue(call: PluginCall) {
        val tracksArray = call.getArray("tracks") ?: run {
            call.reject("tracks is required")
            return
        }
        val startIndex = call.getInt("startIndex") ?: 0
        val playbackRate = call.getDouble("playbackRate")?.toFloat() ?: 1.0f

        val ids = ArrayList<String>(tracksArray.length())
        val mediaItems = ArrayList<MediaItem>(tracksArray.length())
        for (i in 0 until tracksArray.length()) {
            val track = tracksArray.getJSONObject(i)
            val id = track.getString("id")
            val localPath = track.optString("localPath", "")
            val uri = if (localPath.isNotEmpty()) "file://$localPath" else track.getString("url")
            ids.add(id)
            mediaItems.add(
                MediaItem.Builder()
                    .setUri(uri)
                    .setMediaId(id)
                    .setMediaMetadata(
                        MediaMetadata.Builder()
                            .setTitle(track.optString("title", ""))
                            .setAlbumTitle(track.optString("album", ""))
                            .setArtist(track.optString("artist", ""))
                            .build()
                    )
                    .build()
            )
        }

        if (mediaItems.isEmpty()) {
            call.reject("tracks is empty")
            return
        }

        withPlayer(call) { exoPlayer ->
            trackIds = ids
            exoPlayer.playWhenReady = false
            exoPlayer.setMediaItems(mediaItems, startIndex.coerceIn(0, mediaItems.size - 1), 0L)
            exoPlayer.setPlaybackSpeed(playbackRate)
            exoPlayer.prepare()
            call.resolve()
        }
    }

    @PluginMethod
    fun play(call: PluginCall) = withPlayer(call) { exoPlayer ->
        if (exoPlayer.playbackState == Player.STATE_IDLE) exoPlayer.prepare()
        exoPlayer.play()
        call.resolve()
    }

    @PluginMethod
    fun pause(call: PluginCall) = withPlayer(call) { exoPlayer ->
        exoPlayer.pause()
        call.resolve()
    }

    @PluginMethod
    fun seek(call: PluginCall) {
        val index = call.getInt("index") ?: run {
            call.reject("index is required")
            return
        }
        val positionSeconds = call.getDouble("positionSeconds") ?: 0.0
        withPlayer(call) { exoPlayer ->
            exoPlayer.seekTo(index, (positionSeconds * 1000).toLong())
            if (exoPlayer.playbackState == Player.STATE_IDLE) exoPlayer.prepare()
            call.resolve()
        }
    }

    @PluginMethod
    fun next(call: PluginCall) = withPlayer(call) { exoPlayer ->
        exoPlayer.seekToNextMediaItem()
        call.resolve()
    }

    @PluginMethod
    fun previous(call: PluginCall) = withPlayer(call) { exoPlayer ->
        exoPlayer.seekToPreviousMediaItem()
        call.resolve()
    }

    @PluginMethod
    fun setPlaybackRate(call: PluginCall) {
        val rate = call.getDouble("rate")?.toFloat() ?: run {
            call.reject("rate is required")
            return
        }
        withPlayer(call) { exoPlayer ->
            exoPlayer.setPlaybackSpeed(rate)
            call.resolve()
        }
    }

    @PluginMethod
    fun setRepeat(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        withPlayer(call) { exoPlayer ->
            exoPlayer.repeatMode = if (enabled) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF
            call.resolve()
        }
    }

    @PluginMethod
    fun getStatus(call: PluginCall) = withPlayer(call) { exoPlayer ->
        val trackId = trackIds.getOrNull(exoPlayer.currentMediaItemIndex) ?: ""
        call.resolve(statusObject(exoPlayer, trackId).put("isPlaying", isEffectivelyPlaying(exoPlayer)))
    }

    override fun handleOnDestroy() {
        mainHandler.removeCallbacks(positionRunnable)
        attachedPlayer?.removeListener(playerListener)
        attachedPlayer = null
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controllerFuture = null
        super.handleOnDestroy()
    }

    private companion object {
        const val POSITION_INTERVAL_MS = 500L
    }
}
