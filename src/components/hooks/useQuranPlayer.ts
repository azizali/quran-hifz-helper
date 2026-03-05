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
import AudioSessionManager from "../../utils/audioSessionManager";
import { defaultQariKey, type QariKey } from "../controls/qari";
import { getActiveAyatNumber, getTracksToPlay } from "../utils";

const useQuranPlayer = () => {
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioSessionManager = useRef<AudioSessionManager>(AudioSessionManager.getInstance());
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTrackUrl, setActiveTrackUrl] = useState<TrackUrl>("" as TrackUrl);
  const [qariKey, setQariKey] = useLocalStorage<QariKey>("qariKey", defaultQariKey);
  const [surahNumber, setSurahNumber] = useLocalStorage<number>("surahNumber", 1);
  const [ayatRange, setAyatRange] = useLocalStorage<[number, number]>("ayatRange", [1, 1]);
  const [shouldRepeat, setShouldRepeat] = useLocalStorage<boolean>("shouldRepeat", true);

  // Refs to always have fresh values in event listeners (no stale closures)
  const intentToPlayRef = useRef(false);
  const activeTrackUrlRef = useRef<TrackUrl>("" as TrackUrl);
  const tracksToPlayRef = useRef<ReturnType<typeof getTracksToPlay>>([]);
  const shouldRepeatRef = useRef(shouldRepeat);
  const playAyatRef = useRef<(trackUrl: TrackUrl) => void>(() => {});

  // In-memory blob URL cache: remote URL → blob: URL
  // This allows instant track transitions even when the screen is locked,
  // because blob URLs are in-memory and don't need network/SW activity.
  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());

  const surah = useMemo(() => surahs[surahNumber - 1], [surahNumber]);

  const tracksToPlay = useMemo(() => {
    return getTracksToPlay(ayatRange, shouldRepeat, surahNumber, qariKey);
  }, [ayatRange, shouldRepeat, surahNumber, qariKey]);

  // Keep refs in sync
  useEffect(() => { tracksToPlayRef.current = tracksToPlay; }, [tracksToPlay]);
  useEffect(() => { shouldRepeatRef.current = shouldRepeat; }, [shouldRepeat]);

  const activeAyatNumber = useMemo(() => getActiveAyatNumber(activeTrackUrl), [activeTrackUrl]);

  // Preload tracks: fetch audio data and store as in-memory blob URLs
  // This is the key to background playback — blob URLs load instantly
  // with no network/service-worker involvement during track transitions.
  const preloadTracks = useCallback(async (tracks: typeof tracksToPlay) => {
    const blobCache = blobUrlCacheRef.current;

    const preloadPromises = tracks.map(async ({ trackUrl }) => {
      if (blobCache.has(trackUrl)) return; // Already buffered

      try {
        const response = await fetch(trackUrl);
        if (!response.ok) return;
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobCache.set(trackUrl, blobUrl);
        console.log(`Buffered: ${trackUrl}`);
      } catch (error) {
        console.warn(`Failed to buffer ${trackUrl}:`, error);
      }
    });
    await Promise.allSettled(preloadPromises);
  }, []);

  const title = useMemo(
    () => `${surah.name} - Ayat ${activeAyatNumber} / ${surah.numberOfAyats}`,
    [surah.name, activeAyatNumber, surah.numberOfAyats]
  );

  const playAyat = useCallback((trackUrl: TrackUrl) => {
    const audioRef = audioPlayerRef.current;
    if (!audioRef) return;

    // Mark our intent to play — prevents onPause from killing playback during src swap
    intentToPlayRef.current = true;
    activeTrackUrlRef.current = trackUrl;

    try {
      // Use blob URL if available (instant, in-memory, works while screen locked)
      // Fall back to remote URL if not yet buffered
      const blobUrl = blobUrlCacheRef.current.get(trackUrl);
      const srcToUse = blobUrl || trackUrl;

      // Set source if different
      if (audioRef.src !== srcToUse) {
        audioRef.src = srcToUse;
      }
      
      // Call play() synchronously to maintain event chain for background playback
      const playPromise = audioRef.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setActiveTrackUrl(trackUrl);
            
            if ("mediaSession" in navigator) {
              navigator.mediaSession.playbackState = "playing";
              navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                album: surah.name,
                artist: appName,
              });
            }
            
            const activeElement = document.getElementById(trackUrl);
            if (activeElement) {
              const scrollTarget = activeElement.previousElementSibling || activeElement;
              scrollTarget.scrollIntoView({ block: "nearest" });
            }
          })
          .catch((e) => {
            console.error("Error playing audio:", e);
            intentToPlayRef.current = false;
            setIsPlaying(false);
          });
      }
    } catch (error) {
      console.error("Error in playAyat:", error);
      intentToPlayRef.current = false;
      setIsPlaying(false);
    }
  }, [surah.name, title]);

  // Keep playAyat ref current for native event listeners
  useEffect(() => { playAyatRef.current = playAyat; }, [playAyat]);

  const pauseAyat = useCallback(() => {
    intentToPlayRef.current = false;
    const audioRef = audioPlayerRef.current;
    if (audioRef) audioRef.pause();
    setIsPlaying(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  }, []);

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

  const handlePlay = useCallback(
    ({ activeTrackUrl }: { activeTrackUrl: TrackUrl }) => {
      playAyat(activeTrackUrl);
    },
    [playAyat]
  );

  const handlePause = useCallback(() => pauseAyat(), [pauseAyat]);

  const handleReset = () => {
    handleStopAll();
    const firstTrackUrl: TrackUrl = tracksToPlay[0].trackUrl;
    setActiveTrackUrl(firstTrackUrl);
    activeTrackUrlRef.current = firstTrackUrl;
    playAyat(firstTrackUrl);
  };

  const handleAyatClick = useCallback(
    (trackUrl: TrackUrl) => {
      handleStopAll();
      setActiveTrackUrl(trackUrl);
      activeTrackUrlRef.current = trackUrl;
      playAyat(trackUrl);
    },
    [playAyat, handleStopAll]
  );

  // Attach native DOM event listeners for reliable background operation
  // These use refs so they always read fresh state — no stale closures
  useEffect(() => {
    const audioEl = audioPlayerRef.current;
    if (!audioEl) return;

    const onEnded = () => {
      const tracks = tracksToPlayRef.current;
      const currentUrl = activeTrackUrlRef.current;
      const trackIndex = tracks.findIndex(({ trackUrl }) => trackUrl === currentUrl);
      const nextTrackUrl = tracks[trackIndex + 1]?.trackUrl as TrackUrl;

      if (nextTrackUrl) {
        setActiveTrackUrl(nextTrackUrl);
        activeTrackUrlRef.current = nextTrackUrl;
        playAyatRef.current(nextTrackUrl);
        return;
      }
      if (shouldRepeatRef.current) {
        const firstTrackUrl = tracks[0].trackUrl;
        setActiveTrackUrl(firstTrackUrl);
        activeTrackUrlRef.current = firstTrackUrl;
        playAyatRef.current(firstTrackUrl);
        return;
      }
      intentToPlayRef.current = false;
      setIsPlaying(false);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
      }
    };

    // Only set isPlaying(false) on pause if we didn't *intend* to keep playing
    // (i.e., user actually paused, vs. browser pausing during src swap)
    const onPause = () => {
      if (!intentToPlayRef.current) {
        setIsPlaying(false);
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
    };

    audioEl.addEventListener("ended", onEnded);
    audioEl.addEventListener("pause", onPause);
    audioEl.addEventListener("play", onPlay);

    return () => {
      audioEl.removeEventListener("ended", onEnded);
      audioEl.removeEventListener("pause", onPause);
      audioEl.removeEventListener("play", onPlay);
    };
  }, []);  // Empty deps — uses only refs

  // Reset tracks when tracksToPlay changes and preload them
  useEffect(() => {
    if (!tracksToPlay.length) return;
    handleStopAll();
    setActiveTrackUrl(tracksToPlay[0].trackUrl);
    activeTrackUrlRef.current = tracksToPlay[0].trackUrl;

    // Revoke old blob URLs that aren't in the new track list to free memory
    const newTrackUrls = new Set(tracksToPlay.map(t => t.trackUrl));
    const blobCache = blobUrlCacheRef.current;
    for (const [trackUrl, blobUrl] of blobCache.entries()) {
      if (!newTrackUrls.has(trackUrl as TrackUrl)) {
        URL.revokeObjectURL(blobUrl);
        blobCache.delete(trackUrl);
      }
    }

    // Pre-buffer tracks as blob URLs for instant background transitions
    preloadTracks(tracksToPlay);
  }, [tracksToPlay, handleStopAll, preloadTracks]);

  // Update document title
  useEffect(() => {
    document.title = `${title} - ${appName}`;
  }, [title]);

  // Handle page visibility changes to prevent audio stopping
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && intentToPlayRef.current) {
        const audioRef = audioPlayerRef.current;
        if (audioRef && audioRef.paused) {
          audioRef.play().catch(console.error);
        }
      }
    };

    const handleFocus = () => {
      if (intentToPlayRef.current) {
        const audioRef = audioPlayerRef.current;
        if (audioRef && audioRef.paused) {
          audioRef.play().catch(console.error);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []); // No deps — uses refs only

  // Initialize audio session manager on mount
  useEffect(() => {
    audioSessionManager.current.initialize();
    audioSessionManager.current.setupBackgroundAudioHandlers();
    
    // Ensure audio element has proper attributes for background playback
    const audioRef = audioPlayerRef.current;
    if (audioRef) {
      audioRef.setAttribute("playsinline", "true");
      audioRef.setAttribute("webkit-playsinline", "true");
    }
    
    return () => {
      console.log("Component unmounting - audio session cleaned up");
    };
  }, []);

  // Initialize media session action handlers
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      const url = activeTrackUrlRef.current;
      if (url) playAyatRef.current(url);
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      intentToPlayRef.current = false;
      audioPlayerRef.current?.pause();
      setIsPlaying(false);
      navigator.mediaSession.playbackState = "paused";
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      const tracks = tracksToPlayRef.current;
      const currentUrl = activeTrackUrlRef.current;
      const trackIndex = tracks.findIndex(({ trackUrl }) => trackUrl === currentUrl);
      const nextUrl = tracks[trackIndex + 1]?.trackUrl;
      if (nextUrl) {
        setActiveTrackUrl(nextUrl);
        activeTrackUrlRef.current = nextUrl;
        playAyatRef.current(nextUrl);
      }
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      const tracks = tracksToPlayRef.current;
      const currentUrl = activeTrackUrlRef.current;
      const trackIndex = tracks.findIndex(({ trackUrl }) => trackUrl === currentUrl);
      if (trackIndex > 0) {
        const prevUrl = tracks[trackIndex - 1]?.trackUrl;
        setActiveTrackUrl(prevUrl);
        activeTrackUrlRef.current = prevUrl;
        playAyatRef.current(prevUrl);
      }
    });
    
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
    };
  }, []);  // Empty deps — uses only refs

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
    // Handlers
    handlePlay,
    handlePause,
    handleReset,
    handleAyatClick,
  };
};

export default useQuranPlayer;

