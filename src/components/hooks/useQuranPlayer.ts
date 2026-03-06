import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocalStorage } from "usehooks-ts";
import { appName, surahs } from "../../_main/config";
import { type TrackObject, type TrackUrl } from "../../_main/types";
import { defaultQariKey, type QariKey } from "../controls/qari";
import { getActiveAyatNumber, getTracksToPlay } from "../utils";
import { buildConcatenatedAudio } from "./quranPlayer/buildConcatenatedAudio";
import type { TrackOffset } from "./quranPlayer/types";
import { useAudioElementEvents } from "./quranPlayer/useAudioElementEvents";
import { useMediaSession } from "./quranPlayer/useMediaSession";

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
    return getTracksToPlay(ayatRange, surahNumber, qariKey);
  }, [ayatRange, surahNumber, qariKey]);

  // Keep refs in sync
  useEffect(() => { shouldRepeatRef.current = shouldRepeat; }, [shouldRepeat]);

  const activeAyatNumber = useMemo(() => getActiveAyatNumber(activeTrackUrl), [activeTrackUrl]);

  const [preloadProgress, setPreloadProgress] = useState({ loaded: 0, total: 0 });
  const [isReady, setIsReady] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const buildAndAttachAudio = useCallback(async (tracks: TrackObject[]) => {
    const audioRef = audioPlayerRef.current;
    if (!audioRef || tracks.length === 0) return;

    const thisBuildId = ++buildIdRef.current;

    isReadyRef.current = false;
    setIsReady(false);
    setBuildError(null);

    const result = await buildConcatenatedAudio({
      tracks,
      onProgress: setPreloadProgress,
      isStale: () => buildIdRef.current !== thisBuildId,
    });

    if (buildIdRef.current !== thisBuildId) {
      return;
    }

    if (!result) {
      setBuildError(
        "Failed to load audio. Some tracks may be unavailable or your network is too slow. Please try again."
      );
      return;
    }

    if (concatenatedBlobUrlRef.current) {
      URL.revokeObjectURL(concatenatedBlobUrlRef.current);
    }

    concatenatedBlobUrlRef.current = result.blobUrl;
    audioRef.src = result.blobUrl;
    trackOffsetsRef.current = result.offsets;

    const firstTrack = tracks[0];
    if (firstTrack) {
      setActiveTrackUrl(firstTrack.trackUrl);
      activeTrackUrlRef.current = firstTrack.trackUrl;
    }

    isReadyRef.current = true;
    setIsReady(true);
    setBuildError(null);
  }, []);

  // ─── Document title reflects active ayat ───
  const title = useMemo(
    () => `${surah.name} - Ayat ${activeAyatNumber} / ${surah.numberOfAyats}`,
    [surah.name, activeAyatNumber, surah.numberOfAyats]
  );

  const startPlayback = useCallback(() => {
    const audioRef = audioPlayerRef.current;
    if (!audioRef || !isReadyRef.current) return;

    intentToPlayRef.current = true;

    updateMediaSessionMetadata();
    setPlaybackState("playing");

    const p = audioRef.play();
    if (p) {
      p.then(() => setIsPlaying(true)).catch((e) => {
        console.error("play() failed:", e);
        intentToPlayRef.current = false;
        setIsPlaying(false);
      });
    }
  }, []);

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

  const { setPlaybackState, updateMediaSessionMetadata } = useMediaSession({
    surahName: surah.name,
    ayatRange,
    artistName: appName,
    audioPlayerRef,
    intentToPlayRef,
    activeTrackUrlRef,
    trackOffsetsRef,
    startPlaybackRef,
    seekToTrackRef,
    setIsPlaying,
  });

  // ─── Pause ───
  const pauseAyat = useCallback(() => {
    intentToPlayRef.current = false;
    audioPlayerRef.current?.pause();
    setIsPlaying(false);
    setPlaybackState("paused");
  }, [setPlaybackState]);

  // ─── Stop everything ───
  const handleStopAll = useCallback(() => {
    intentToPlayRef.current = false;
    setIsPlaying(false);
    const elm = audioPlayerRef.current;
    if (elm) {
      elm.pause();
      elm.currentTime = 0;
    }
    setPlaybackState("none");
  }, [setPlaybackState]);

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

  useAudioElementEvents({
    audioPlayerRef,
    intentToPlayRef,
    shouldRepeatRef,
    trackOffsetsRef,
    activeTrackUrlRef,
    setActiveTrackUrl,
    setIsPlaying,
    onTrackChanged: () => {
      updateMediaSessionMetadata();
      const element = document.getElementById(activeTrackUrlRef.current);
      if (element) {
        const scrollTarget = element.previousElementSibling || element;
        scrollTarget.scrollIntoView({ block: "nearest" });
      }
    },
    onPlaybackStopped: () => setPlaybackState("none"),
  });

  // ─── Rebuild concatenated audio when tracks change ───
  useEffect(() => {
    if (!tracksToPlay.length) return;
    handleStopAll();
    buildAndAttachAudio(tracksToPlay);
  }, [tracksToPlay, handleStopAll, buildAndAttachAudio]);

  // Retry audio build on demand
  const retryAudioBuild = useCallback(() => {
    if (tracksToPlay.length > 0) {
      buildAndAttachAudio(tracksToPlay);
    }
  }, [tracksToPlay, buildAndAttachAudio]);

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

  useEffect(() => {
    return () => {
      if (concatenatedBlobUrlRef.current) {
        URL.revokeObjectURL(concatenatedBlobUrlRef.current);
      }
    };
  }, []);

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
    buildError,
    // Handlers
    handlePlay,
    handlePause,
    handleReset,
    handleAyatClick,
    retryAudioBuild,
  };
};

export default useQuranPlayer;
