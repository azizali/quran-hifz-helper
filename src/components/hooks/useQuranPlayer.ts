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

  const surah = useMemo(() => surahs[surahNumber - 1], [surahNumber]);

  const tracksToPlay = useMemo(() => {
    return getTracksToPlay(ayatRange, shouldRepeat, surahNumber, qariKey);
  }, [ayatRange, shouldRepeat, surahNumber, qariKey]);

  // Keep refs in sync
  useEffect(() => { tracksToPlayRef.current = tracksToPlay; }, [tracksToPlay]);
  useEffect(() => { shouldRepeatRef.current = shouldRepeat; }, [shouldRepeat]);

  const activeAyatNumber = useMemo(() => getActiveAyatNumber(activeTrackUrl), [activeTrackUrl]);

  // Preload tracks for offline playback
  const preloadTracks = useCallback(async (tracks: typeof tracksToPlay) => {
    if (!('caches' in window)) return;
    
    try {
      const cache = await caches.open('audio-cache');
      const preloadPromises = tracks.map(async ({ trackUrl }) => {
        try {
          const response = await cache.match(trackUrl);
          if (!response) {
            // Not in cache, fetch and cache it
            await cache.add(trackUrl);
            console.log(`Preloaded: ${trackUrl}`);
          }
        } catch (error) {
          console.warn(`Failed to preload ${trackUrl}:`, error);
        }
      });
      await Promise.allSettled(preloadPromises);
    } catch (error) {
      console.error('Error preloading tracks:', error);
    }
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
      // Set source if different
      if (!audioRef.src.includes(trackUrl)) {
        audioRef.src = trackUrl;
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
    
    // Preload tracks for smooth offline playback
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

