import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocalStorage } from "usehooks-ts";
import { appName, surahs } from "../../_main/config";
import { type TrackUrl } from "../../_main/types";
import { REPEAT_SOUND_TRACK } from "../controls/AyatList";
import { defaultQariKey, type QariKey } from "../controls/qari";
import { getActiveAyatNumber, getTracksToPlay } from "../utils";

/**
 * ARCHITECTURE: Concatenated Audio Playback
 *
 * Instead of swapping audio.src between tracks (which Android kills when
 * the screen is locked), we concatenate ALL track MP3 data into a single
 * blob and set it as the src ONCE. During playback, we use timeupdate
 * to track which ayat is active based on cumulative duration offsets.
 *
 * This means:
 * - ZERO src changes during playback
 * - Audio plays as one continuous stream (like a podcast)
 * - Android has no opportunity to kill the audio session
 * - Seeking to a specific ayat = seeking to its time offset
 * - Repeat = seek back to 0 when the concatenated audio ends
 *
 * The track list is built WITHOUT shouldRepeat — repeat is handled
 * purely by seeking to 0 on end. This avoids rebuilding audio when
 * the repeat checkbox is toggled.
 */

interface TrackOffset {
  trackUrl: TrackUrl;
  startTime: number;
  endTime: number;
}

/** Encode an AudioBuffer as a WAV Blob (16-bit PCM). */
function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2; // 16-bit
  const dataLength = numSamples * numChannels * bytesPerSample;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;
  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeStr(view, 0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeStr(view, 8, "WAVE");

  // fmt chunk
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);

  // data chunk
  writeStr(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Interleave channel data as 16-bit PCM
  let offset = headerLength;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

const useQuranPlayer = () => {
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrackUrl, setActiveTrackUrl] = useState<TrackUrl>("" as TrackUrl);
  const [qariKey, setQariKey] = useLocalStorage<QariKey>("qariKey", defaultQariKey);
  const [surahNumber, setSurahNumber] = useLocalStorage<number>("surahNumber", 1);
  const [ayatRange, setAyatRange] = useLocalStorage<[number, number]>("ayatRange", [1, 1]);
  const [shouldRepeat, setShouldRepeat] = useLocalStorage<boolean>("shouldRepeat", true);

  // Refs for event listeners (avoid stale closures)
  const intentToPlayRef = useRef(false);
  const activeTrackUrlRef = useRef<TrackUrl>("" as TrackUrl);
  const shouldRepeatRef = useRef(shouldRepeat);
  const trackOffsetsRef = useRef<TrackOffset[]>([]);
  const concatenatedBlobUrlRef = useRef<string>("");
  const computedDurationRef = useRef(0); // accurate total duration from decodeAudioData
  const isReadyRef = useRef(false);
  const buildIdRef = useRef(0); // to discard stale builds

  const surah = useMemo(() => surahs[surahNumber - 1], [surahNumber]);

  // Track list WITHOUT repeat — repeat is purely seek-to-0 logic
  // This prevents rebuilding the concatenated audio when toggling repeat
  const tracksToPlay = useMemo(() => {
    return getTracksToPlay(ayatRange, shouldRepeat, surahNumber, qariKey);
  }, [ayatRange, shouldRepeat, surahNumber, qariKey]);

  // The actual tracks used for the concatenated audio (no REPEAT_SOUND_TRACK)
  const audioTracks = useMemo(() => {
    return tracksToPlay.filter(t => t.trackUrl !== REPEAT_SOUND_TRACK);
  }, [tracksToPlay]);

  // Keep refs in sync
  useEffect(() => { shouldRepeatRef.current = shouldRepeat; }, [shouldRepeat]);

  const activeAyatNumber = useMemo(() => getActiveAyatNumber(activeTrackUrl), [activeTrackUrl]);

  const [preloadProgress, setPreloadProgress] = useState({ loaded: 0, total: 0 });
  const [isReady, setIsReady] = useState(false);

  // ─── Build concatenated audio blob from all tracks ───
  // Decodes all MP3s to PCM, merges into one AudioBuffer, encodes as WAV.
  // WAV has linear byte-to-time mapping so seeking works perfectly,
  // unlike raw MP3 concatenation where the browser misinterprets seek positions.
  const buildConcatenatedAudio = useCallback(async (tracks: typeof tracksToPlay) => {
    const audioRef = audioPlayerRef.current;
    if (!audioRef || tracks.length === 0) return;

    // Increment build ID so any in-flight build gets discarded
    const thisBuildId = ++buildIdRef.current;

    isReadyRef.current = false;
    setIsReady(false);

    const total = tracks.length;
    let loaded = 0;
    setPreloadProgress({ loaded, total });

    // Fetch all tracks in parallel (order preserved by index)
    const fetchPromises = tracks.map(async ({ trackUrl }) => {
      try {
        const response = await fetch(trackUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.arrayBuffer();
      } catch (error) {
        console.error(`Failed to fetch ${trackUrl}:`, error);
        return new ArrayBuffer(0);
      }
    });

    const settled = await Promise.allSettled(fetchPromises);
    if (buildIdRef.current !== thisBuildId) return; // stale

    // Decode all MP3s into AudioBuffers
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const decodedBuffers: AudioBuffer[] = [];

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      const buffer = result.status === "fulfilled" ? result.value : new ArrayBuffer(0);

      if (buffer.byteLength > 0) {
        try {
          const decoded = await audioCtx.decodeAudioData(buffer.slice(0));
          decodedBuffers.push(decoded);
        } catch {
          // Create a tiny silent buffer as placeholder for failed decodes
          const silent = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.01, audioCtx.sampleRate);
          decodedBuffers.push(silent);
        }
      } else {
        const silent = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.01, audioCtx.sampleRate);
        decodedBuffers.push(silent);
      }

      loaded++;
      setPreloadProgress({ loaded, total });
    }

    if (buildIdRef.current !== thisBuildId) { await audioCtx.close(); return; }

    // Calculate total length and build offset map
    const sampleRate = decodedBuffers[0]?.sampleRate || audioCtx.sampleRate;
    const numberOfChannels = Math.max(...decodedBuffers.map(b => b.numberOfChannels), 1);
    let totalSamples = 0;
    const offsets: TrackOffset[] = [];

    for (let i = 0; i < decodedBuffers.length; i++) {
      const startTime = totalSamples / sampleRate;
      totalSamples += decodedBuffers[i].length;
      const endTime = totalSamples / sampleRate;
      offsets.push({ trackUrl: tracks[i].trackUrl, startTime, endTime });
    }

    trackOffsetsRef.current = offsets;
    const totalDuration = totalSamples / sampleRate;
    computedDurationRef.current = totalDuration;

    // Merge all decoded PCM data into one buffer
    const mergedBuffer = audioCtx.createBuffer(numberOfChannels, totalSamples, sampleRate);
    let sampleOffset = 0;
    for (const buf of decodedBuffers) {
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const destData = mergedBuffer.getChannelData(ch);
        const srcCh = ch < buf.numberOfChannels ? ch : 0;
        destData.set(buf.getChannelData(srcCh), sampleOffset);
      }
      sampleOffset += buf.length;
    }

    await audioCtx.close();
    if (buildIdRef.current !== thisBuildId) return;

    // Encode merged AudioBuffer as WAV
    const wavBlob = encodeWav(mergedBuffer);

    // Revoke previous blob URL
    if (concatenatedBlobUrlRef.current) {
      URL.revokeObjectURL(concatenatedBlobUrlRef.current);
    }

    const blobUrl = URL.createObjectURL(wavBlob);
    concatenatedBlobUrlRef.current = blobUrl;

    // Set the single source — this is the ONLY time src is set
    audioRef.src = blobUrl;

    // Set initial active track
    if (tracks.length > 0) {
      setActiveTrackUrl(tracks[0].trackUrl);
      activeTrackUrlRef.current = tracks[0].trackUrl;
    }

    isReadyRef.current = true;
    setIsReady(true);

    console.log(
      `Audio ready: ${tracks.length} tracks, ${totalDuration.toFixed(1)}s, ` +
      `${numberOfChannels}ch ${sampleRate}Hz, ` +
      `${(wavBlob.size / 1024 / 1024).toFixed(1)}MB WAV`
    );
  }, []);

  // ─── MediaSession metadata helper ───
  const updateMediaSessionMetadata = useCallback(() => {
    if (!("mediaSession" in navigator)) return;
    const [startAyat, endAyat] = ayatRange;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${surah.name} - Ayat ${startAyat}-${endAyat}`,
      album: surah.name,
      artist: appName,
    });
  }, [surah.name, ayatRange]);

  const updateMediaSessionRef = useRef(updateMediaSessionMetadata);
  useEffect(() => { updateMediaSessionRef.current = updateMediaSessionMetadata; }, [updateMediaSessionMetadata]);

  // ─── Document title reflects active ayat ───
  const title = useMemo(
    () => `${surah.name} - Ayat ${activeAyatNumber} / ${surah.numberOfAyats}`,
    [surah.name, activeAyatNumber, surah.numberOfAyats]
  );

  // ─── Start or resume playback (no src change) ───
  const startPlayback = useCallback(() => {
    const audioRef = audioPlayerRef.current;
    if (!audioRef || !isReadyRef.current) return;

    intentToPlayRef.current = true;

    updateMediaSessionMetadata();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }

    const p = audioRef.play();
    if (p) {
      p.then(() => setIsPlaying(true)).catch((e) => {
        console.error("play() failed:", e);
        intentToPlayRef.current = false;
        setIsPlaying(false);
      });
    }
  }, [activeAyatNumber, updateMediaSessionMetadata]);

  // Refs for use in native event listeners
  const startPlaybackRef = useRef(startPlayback);
  useEffect(() => { startPlaybackRef.current = startPlayback; }, [startPlayback]);

  // ─── Seek to a specific track's offset and play ───
  const seekToTrack = useCallback((trackUrl: TrackUrl) => {
    const audioRef = audioPlayerRef.current;
    if (!audioRef || !isReadyRef.current) return;

    const offset = trackOffsetsRef.current.find(o => o.trackUrl === trackUrl);
    if (offset) {
      audioRef.currentTime = offset.startTime;
      setActiveTrackUrl(trackUrl);
      activeTrackUrlRef.current = trackUrl;
      startPlayback();
    }
  }, [startPlayback]);

  const seekToTrackRef = useRef(seekToTrack);
  useEffect(() => { seekToTrackRef.current = seekToTrack; }, [seekToTrack]);

  // ─── Pause ───
  const pauseAyat = useCallback(() => {
    intentToPlayRef.current = false;
    audioPlayerRef.current?.pause();
    setIsPlaying(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  }, []);

  // ─── Stop everything ───
  const handleStopAll = useCallback(() => {
    intentToPlayRef.current = false;
    setIsPlaying(false);
    const elm = audioPlayerRef.current;
    if (elm) {
      elm.pause();
      elm.currentTime = 0;
    }
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
  }, []);

  // ─── Public handlers ───
  const handlePlay = useCallback(
    ({ activeTrackUrl }: { activeTrackUrl: TrackUrl }) => {
      seekToTrack(activeTrackUrl);
    },
    [seekToTrack]
  );

  const handlePause = useCallback(() => pauseAyat(), [pauseAyat]);

  const handleReset = useCallback(() => {
    const audioRef = audioPlayerRef.current;
    if (!audioRef || !isReadyRef.current) return;
    audioRef.currentTime = 0;
    if (trackOffsetsRef.current.length > 0) {
      const first = trackOffsetsRef.current[0];
      setActiveTrackUrl(first.trackUrl);
      activeTrackUrlRef.current = first.trackUrl;
    }
    startPlayback();
  }, [startPlayback]);

  const handleAyatClick = useCallback(
    (trackUrl: TrackUrl) => seekToTrack(trackUrl),
    [seekToTrack]
  );

  // ─── Native DOM event listeners ───
  useEffect(() => {
    const audioEl = audioPlayerRef.current;
    if (!audioEl) return;

    // Track which ayat is playing based on the current time position
    const onTimeUpdate = () => {
      const currentTime = audioEl.currentTime;
      const offsets = trackOffsetsRef.current;

      for (let i = offsets.length - 1; i >= 0; i--) {
        if (currentTime >= offsets[i].startTime - 0.05) {
          const trackUrl = offsets[i].trackUrl;
          if (trackUrl !== activeTrackUrlRef.current) {
            activeTrackUrlRef.current = trackUrl;
            setActiveTrackUrl(trackUrl);

            // Update MediaSession with current ayat info
            updateMediaSessionRef.current();

            // Scroll into view
            const el = document.getElementById(trackUrl);
            if (el) {
              const scrollTarget = el.previousElementSibling || el;
              scrollTarget.scrollIntoView({ block: "nearest" });
            }
          }
          break;
        }
      }
    };

    // The WAV audio has ended
    const onEnded = () => {
      if (shouldRepeatRef.current) {
        // Loop: seek back to start and play — no src change!
        audioEl.currentTime = 0;
        if (trackOffsetsRef.current.length > 0) {
          const first = trackOffsetsRef.current[0];
          setActiveTrackUrl(first.trackUrl);
          activeTrackUrlRef.current = first.trackUrl;
        }
        audioEl.play().catch(console.error);
        return;
      }
      intentToPlayRef.current = false;
      setIsPlaying(false);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
      }
    };

    const onPause = () => {
      if (!intentToPlayRef.current) {
        setIsPlaying(false);
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
    };

    audioEl.addEventListener("timeupdate", onTimeUpdate);
    audioEl.addEventListener("ended", onEnded);
    audioEl.addEventListener("pause", onPause);
    audioEl.addEventListener("play", onPlay);

    return () => {
      audioEl.removeEventListener("timeupdate", onTimeUpdate);
      audioEl.removeEventListener("ended", onEnded);
      audioEl.removeEventListener("pause", onPause);
      audioEl.removeEventListener("play", onPlay);
    };
  }, []); // Empty deps — all state read via refs

  // ─── Rebuild concatenated audio when audio tracks change ───
  // Uses audioTracks (no REPEAT_SOUND_TRACK) so toggling repeat won't rebuild
  useEffect(() => {
    if (!audioTracks.length) return;
    handleStopAll();
    buildConcatenatedAudio(audioTracks);
  }, [audioTracks, handleStopAll, buildConcatenatedAudio]);

  // Update document title
  useEffect(() => {
    document.title = `${title} - ${appName}`;
  }, [title]);

  // Resume playback on visibility restore (e.g., screen unlock)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && intentToPlayRef.current) {
        const audioRef = audioPlayerRef.current;
        if (audioRef && audioRef.paused) {
          audioRef.play().catch(console.error);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, []);

  // Ensure audio element has proper attributes for background playback
  useEffect(() => {
    const audioRef = audioPlayerRef.current;
    if (audioRef) {
      audioRef.setAttribute("playsinline", "true");
      audioRef.setAttribute("webkit-playsinline", "true");
    }
  }, []);

  // MediaSession action handlers (lock screen controls)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      startPlaybackRef.current();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      intentToPlayRef.current = false;
      audioPlayerRef.current?.pause();
      setIsPlaying(false);
      navigator.mediaSession.playbackState = "paused";
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      const offsets = trackOffsetsRef.current;
      const currentUrl = activeTrackUrlRef.current;
      const idx = offsets.findIndex(o => o.trackUrl === currentUrl);
      if (idx >= 0 && idx < offsets.length - 1) {
        seekToTrackRef.current(offsets[idx + 1].trackUrl);
      }
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      const offsets = trackOffsetsRef.current;
      const currentUrl = activeTrackUrlRef.current;
      const idx = offsets.findIndex(o => o.trackUrl === currentUrl);
      if (idx > 0) {
        seekToTrackRef.current(offsets[idx - 1].trackUrl);
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
    };
  }, []); // Empty deps — uses only refs

  return {
    // State
    isPlaying,
    activeTrackUrl,
    activeAyatNumber,
    qariKey,
    setQariKey,
    surah,
    surahNumber,
    setSurahNumber,
    ayatRange,
    setAyatRange,
    shouldRepeat,
    setShouldRepeat,
    tracksToPlay,
    audioPlayerRef,
    preloadProgress,
    isReady,
    // Handlers
    handlePlay,
    handlePause,
    handleReset,
    handleAyatClick,
  };
};

export default useQuranPlayer;
