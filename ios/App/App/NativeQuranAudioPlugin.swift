import Foundation
import Capacitor
import AVFoundation
import MediaPlayer

@objc(NativeQuranAudioPlugin)
public class NativeQuranAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeQuranAudioPlugin"
    public let jsName = "NativeQuranAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setQueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "next", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "previous", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPlaybackRate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRepeat", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise)
    ]

    private struct Track {
        let id: String
        let url: URL
        let title: String
        let album: String
        let artist: String
    }

    // AVQueuePlayer degrades with thousands of items, so only a short window is enqueued.
    private static let windowSize = 3

    private let player = AVQueuePlayer()
    private var tracks: [Track] = []
    private var enqueued: [(item: AVPlayerItem, index: Int)] = []
    private var currentIndex = 0
    private var lastCurrentItem: AVPlayerItem?
    private var repeatEnabled = false
    private var playbackRate: Float = 1.0
    private var wantsPlay = false
    private var lastIsPlaying: Bool?
    private var nowPlayingHasDuration = false

    private var periodicObserver: Any?
    private var observations: [NSKeyValueObservation] = []
    private var notificationObservers: [NSObjectProtocol] = []

    override public func load() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        DispatchQueue.main.async {
            self.observePlayer()
            self.setupRemoteCommands()
        }
    }

    // MARK: - Observation

    private func observePlayer() {
        periodicObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.5, preferredTimescale: 600),
            queue: .main
        ) { [weak self] _ in
            self?.emitPositionUpdate()
        }

        observations.append(player.observe(\.currentItem, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async { self?.handleCurrentItemChanged() }
        })
        observations.append(player.observe(\.timeControlStatus, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async { self?.syncPlaying() }
        })
        observations.append(player.observe(\.currentItem?.status, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async { self?.handleItemStatusChanged() }
        })

        let center = NotificationCenter.default
        notificationObservers.append(center.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] notification in
            self?.handleInterruption(notification)
        })
        notificationObservers.append(center.addObserver(
            forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main
        ) { [weak self] notification in
            self?.handleRouteChange(notification)
        })
    }

    private func handleCurrentItemChanged() {
        guard let current = player.currentItem else {
            if lastCurrentItem != nil && wantsPlay && !tracks.isEmpty {
                endPlayback()
                lastCurrentItem = nil
                notifyListeners("queueEnded", data: [:])
            }
            return
        }
        guard current !== lastCurrentItem else { return }
        lastCurrentItem = current
        nowPlayingHasDuration = false

        if let position = enqueued.firstIndex(where: { $0.item === current }) {
            currentIndex = enqueued[position].index
            enqueued.removeFirst(position)
            topUpQueue()
        }

        if let track = tracks[safe: currentIndex] {
            notifyListeners("trackChanged", data: ["index": currentIndex, "trackId": track.id])
        }
        updateNowPlayingInfo()
        emitPositionUpdate()
    }

    private func handleItemStatusChanged() {
        guard let item = player.currentItem, item.status == .failed else {
            emitPositionUpdate()
            return
        }
        wantsPlay = false
        player.pause()
        notifyListeners("playbackError", data: ["message": item.error?.localizedDescription ?? "Playback failed"])
    }

    private func handleInterruption(_ notification: Notification) {
        guard let info = notification.userInfo,
              let rawType = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              AVAudioSession.InterruptionType(rawValue: rawType) == .ended else { return }

        let rawOptions = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        if wantsPlay && AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume) {
            startPlayer()
        } else {
            wantsPlay = false
            syncPlaying()
        }
    }

    private func handleRouteChange(_ notification: Notification) {
        guard let rawReason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
              AVAudioSession.RouteChangeReason(rawValue: rawReason) == .oldDeviceUnavailable else { return }
        wantsPlay = false
        player.pause()
    }

    private func syncPlaying() {
        let isPlaying = player.timeControlStatus != .paused
        guard isPlaying != lastIsPlaying else { return }
        lastIsPlaying = isPlaying
        notifyListeners("playbackState", data: ["isPlaying": isPlaying])
        updateNowPlayingInfo()
    }

    private func statusData() -> [String: Any] {
        let position = player.currentItem?.currentTime().seconds ?? 0
        let duration = player.currentItem?.duration.seconds ?? 0
        return [
            "index": currentIndex,
            "trackId": tracks[safe: currentIndex]?.id ?? "",
            "positionSeconds": position.isFinite ? position : 0,
            "durationSeconds": duration.isFinite ? duration : 0
        ]
    }

    private func emitPositionUpdate() {
        guard player.currentItem != nil, !tracks.isEmpty else { return }
        notifyListeners("positionUpdate", data: statusData())

        let duration = player.currentItem?.duration.seconds ?? 0
        if duration.isFinite && duration > 0 && !nowPlayingHasDuration {
            nowPlayingHasDuration = true
            updateNowPlayingInfo()
        }
    }

    // MARK: - Queue

    private func makeItem(index: Int) -> AVPlayerItem {
        let item = AVPlayerItem(url: tracks[index].url)
        item.audioTimePitchAlgorithm = .timeDomain
        return item
    }

    private func nextIndex(after index: Int) -> Int? {
        if index + 1 < tracks.count { return index + 1 }
        return repeatEnabled ? 0 : nil
    }

    private func topUpQueue() {
        while enqueued.count < Self.windowSize, let last = enqueued.last,
              let next = nextIndex(after: last.index) {
            let item = makeItem(index: next)
            player.insert(item, after: last.item)
            enqueued.append((item: item, index: next))
        }
    }

    private func replaceQueue(startingAt index: Int) {
        guard !tracks.isEmpty else { return }
        let start = min(max(index, 0), tracks.count - 1)
        player.removeAllItems()
        currentIndex = start
        let first = makeItem(index: start)
        player.insert(first, after: nil)
        enqueued = [(item: first, index: start)]
        topUpQueue()
    }

    // Re-derives upcoming items, e.g. after repeat changes which track follows the last.
    private func rebuildUpcoming() {
        guard let first = enqueued.first else { return }
        enqueued.dropFirst().forEach { player.remove($0.item) }
        enqueued = [first]
        topUpQueue()
    }

    private func startPlayer() {
        try? AVAudioSession.sharedInstance().setActive(true)
        player.rate = playbackRate
    }

    private func beginPlayback() {
        if player.currentItem == nil { replaceQueue(startingAt: currentIndex) }
        wantsPlay = true
        startPlayer()
    }

    private func endPlayback() {
        wantsPlay = false
        player.pause()
    }

    private func jump(to index: Int, positionSeconds: Double) {
        if index != currentIndex || player.currentItem == nil {
            replaceQueue(startingAt: index)
        }
        player.seek(
            to: CMTime(seconds: positionSeconds, preferredTimescale: 600),
            toleranceBefore: .zero,
            toleranceAfter: .zero
        ) { [weak self] _ in
            DispatchQueue.main.async {
                self?.emitPositionUpdate()
                self?.updateNowPlayingInfo()
            }
        }
        if wantsPlay { startPlayer() }
    }

    private func skipForward() -> Bool {
        guard currentIndex + 1 < tracks.count else { return false }
        jump(to: currentIndex + 1, positionSeconds: 0)
        return true
    }

    private func skipBackward() -> Bool {
        guard currentIndex > 0 else { return false }
        jump(to: currentIndex - 1, positionSeconds: 0)
        return true
    }

    // MARK: - Plugin methods

    @objc func setQueue(_ call: CAPPluginCall) {
        guard let rawTracks = call.getArray("tracks", JSObject.self) else {
            call.reject("tracks is required")
            return
        }

        let parsed: [Track] = rawTracks.compactMap { track in
            guard let id = track["id"] as? String else { return nil }
            let url: URL?
            if let localPath = track["localPath"] as? String, !localPath.isEmpty {
                url = URL(fileURLWithPath: localPath)
            } else {
                url = (track["url"] as? String).flatMap(URL.init(string:))
            }
            guard let resolved = url else { return nil }
            return Track(
                id: id,
                url: resolved,
                title: track["title"] as? String ?? "",
                album: track["album"] as? String ?? "",
                artist: track["artist"] as? String ?? ""
            )
        }
        let startIndex = call.getInt("startIndex") ?? 0
        let rate = call.getDouble("playbackRate").map { Float($0) }

        DispatchQueue.main.async {
            self.endPlayback()
            self.tracks = parsed
            if let rate = rate { self.playbackRate = rate }
            self.lastCurrentItem = nil
            self.replaceQueue(startingAt: startIndex)
            call.resolve()
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.beginPlayback()
            call.resolve()
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.endPlayback()
            call.resolve()
        }
    }

    @objc func seek(_ call: CAPPluginCall) {
        guard let index = call.getInt("index") else {
            call.reject("index is required")
            return
        }
        let positionSeconds = call.getDouble("positionSeconds") ?? 0
        DispatchQueue.main.async {
            self.jump(to: index, positionSeconds: positionSeconds)
            call.resolve()
        }
    }

    @objc func next(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            _ = self.skipForward()
            call.resolve()
        }
    }

    @objc func previous(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            _ = self.skipBackward()
            call.resolve()
        }
    }

    @objc func setPlaybackRate(_ call: CAPPluginCall) {
        guard let rate = call.getDouble("rate") else {
            call.reject("rate is required")
            return
        }
        DispatchQueue.main.async {
            self.playbackRate = Float(rate)
            if self.wantsPlay { self.player.rate = self.playbackRate }
            self.updateNowPlayingInfo()
            call.resolve()
        }
    }

    @objc func setRepeat(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        DispatchQueue.main.async {
            self.repeatEnabled = enabled
            self.rebuildUpcoming()
            call.resolve()
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            var data = self.statusData()
            data["isPlaying"] = self.player.timeControlStatus != .paused
            call.resolve(data)
        }
    }

    // MARK: - Lock screen / Control Center

    private func setupRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()

        center.playCommand.addTarget { [weak self] _ in
            self?.beginPlayback()
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            self?.endPlayback()
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            if self.wantsPlay { self.endPlayback() } else { self.beginPlayback() }
            return .success
        }
        center.nextTrackCommand.addTarget { [weak self] _ in
            self?.skipForward() == true ? .success : .noSuchContent
        }
        center.previousTrackCommand.addTarget { [weak self] _ in
            self?.skipBackward() == true ? .success : .noSuchContent
        }
    }

    private func updateNowPlayingInfo() {
        guard let track = tracks[safe: currentIndex] else { return }

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyAlbumTitle: track.album,
            MPMediaItemPropertyArtist: track.artist,
            MPNowPlayingInfoPropertyPlaybackRate: player.rate
        ]

        if let item = player.currentItem {
            let position = item.currentTime().seconds
            let duration = item.duration.seconds
            if position.isFinite { info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = position }
            if duration.isFinite { info[MPMediaItemPropertyPlaybackDuration] = duration }
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
