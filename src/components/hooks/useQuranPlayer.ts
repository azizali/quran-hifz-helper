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
 */

interface TrackOffset {
  trackUrl: TrackUrl;
  startTime: number;
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
  const isReadyRef = useRef(false);
  const buildIdRef = useRef(0); // to discard stale builds

  const surah = useMemo(() => surahs[surahNumber - 1], [surahNumber]);

  const tracksToPlay = useMemo(() => {
    return getTracksToPlay(ayatRange, shouldRepeat, surahNumber, qariKey);
  }, [ayatRange, shouldRepeat, surahNumber, qariKey]);

  // Keep refs in sync
  useEffect(() => { shouldRepeatRef.current = shouldRepeat; }, [shouldRepeat]);

  const activeAyatNumber = useMemo(() => getActiveAyatNumber(activeTrackUrl), [activeTrackUrl]);

  const [preloadProgress, setPreloadProgress] = useState({ loaded: 0, total: 0 });
  const [isReady, setIsReady] = useState(false);

  // ─── Build concatenated audio blob from all tracks ───
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

    const buffers: ArrayBuffer[] = [];
    const durations: number[] = [];

    // Measure each track's duration via AudioContext.decodeAudioData
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      const buffer = result.status === "fulfilled" ? result.value : new ArrayBuffer(0);
      buffers.push(buffer);

      if (buffer.byteLength > 0) {
        try {
          // decodeAudioData detaches the buffer, so decode a copy
          const decoded = await audioCtx.decodeAudioData(buffer.slice(0));
          durations.push(decoded.duration);
        } catch {
          durations.push(0);
        }
      } else {
        durations.push(0);
      }

      loaded++;
      setPreloadProgress({ loaded, total });
    }

    await audioCtx.close();
    if (buildIdRef.current !== thisBuildId) return; // stale

    // Build cumulative time offset map
    const offsets: TrackOffset[] = [];
    let cumTime = 0;
    for (let i = 0; i < tracks.length; i++) {
      offsets.push({ trackUrl: tracks[i].trackUrl, startTime: cumTime });
      cumTime += durations[i];
    }
    trackOffsetsRef.current = offsets;

    // Concatenate raw MP3 bytes into one blob
    // (MP3 is frame-based — raw concatenation produces a valid stream)
    const totalBytes = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const merged = new Uint8Array(totalBytes);
    let byteOffset = 0;
    for (const buf of buffers) {
      merged.set(new Uint8Array(buf), byteOffset);
      byteOffset += buf.byteLength;
    }

    // Revoke previous blob URL
    if (concatenatedBlobUrlRef.current) {
      URL.revokeObjectURL(concatenatedBlobUrlRef.current);
    }

    const blob = new Blob([merged], { type: "audio/mpeg" });
    const blobUrl = URL.createObjectURL(blob);
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
      `Audio ready: ${tracks.length} tracks, ${cumTime.toFixed(1)}s total, ` +
      `${(totalBytes / 1024 / 1024).toFixed(1)}MB`
    );
  }, []);

  const title = useMemo(
    () => `${surah.name} - Ayat ${activeAyatNumber} / ${surah.numberOfAyats}`,
    [surah.name, activeAyatNumber, surah.numberOfAyats]
  );

  // ─── Start or resume playback (no src change) ───
  const startPlayback = useCallback(() => {
    const audioRef = audioPlayerRef.current;
    if (!audioRef || !isReadyRef.current) return;

    intentToPlayRef.current = true;

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        album: surah.name,
        artist: appName,
      });
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
  }, [title, surah.name]);

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

            // Scroll into view (skip for repeat sound)
            if (trackUrl !== REPEAT_SOUND_TRACK) {
              const el = document.getElementById(trackUrl);
              if (el) {
                const scrollTarget = el.previousElementSibling || el;
                scrollTarget.scrollIntoView({ block: "nearest" });
              }
            }
          }
          break;
        }
      }
    };

    // The entire concatenated audio has ended
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

  // ─── Rebuild concatenated audio when track list changes ───
  useEffect(() => {
    if (!tracksToPlay.length) return;
    handleStopAll();
    buildConcatenatedAudio(tracksToPlay);
  }, [tracksToPlay, handleStopAll, buildConcatenatedAudio]);

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
