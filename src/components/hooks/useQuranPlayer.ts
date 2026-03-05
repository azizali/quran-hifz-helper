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

  const surah = useMemo(() => surahs[surahNumber - 1], [surahNumber]);

  const tracksToPlay = useMemo(() => {
    return getTracksToPlay(ayatRange, shouldRepeat, surahNumber, qariKey);
  }, [ayatRange, shouldRepeat, surahNumber, qariKey]);

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
    // CRITICAL: This function must remain synchronous for mobile background playback
    // Any async operations before play() will break the user-gesture chain
    
    const audioRef = audioPlayerRef.current;
    if (!audioRef) return;

    try {
      // Synchronously change source and play - NO async calls before this
      if (!audioRef.src.includes(trackUrl)) {
        audioRef.src = trackUrl;
        audioRef.setAttribute("data-trackurl", trackUrl);
      }
      
      // Call play() synchronously - this maintains the event chain from onEnded
      const playPromise = audioRef.play();
      
      // Handle play promise errors asynchronously (after play is called)
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            
            // Update MediaSession metadata after successful play
            if ("mediaSession" in navigator) {
              navigator.mediaSession.playbackState = "playing";
              navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                album: surah.name,
                artist: appName,
              });
            }
            
            // Scroll to active element
            const activeElement = document.getElementById(trackUrl);
            if (activeElement) {
              if (activeElement.previousElementSibling) {
                activeElement.previousElementSibling.scrollIntoView();
              } else {
                activeElement.scrollIntoView();
              }
            }
          })
          .catch((e) => {
            console.error("Error playing audio:", e);
            setIsPlaying(false);
          });
      }
    } catch (error) {
      console.error("Error in playAyat:", error);
      setIsPlaying(false);
    }
  }, [surah.name, title]);

  const pauseAyat = useCallback(() => {
    const audioRef = audioPlayerRef.current;
    if (audioRef) audioRef.pause();
    setIsPlaying(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  }, []);

  const handleStopAll = useCallback(() => {
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
    handlePlay({ activeTrackUrl: firstTrackUrl });
  };

  const handleEnded = useCallback(() => {
    const currentTrackUrl = audioPlayerRef.current?.getAttribute("data-trackurl") || activeTrackUrl;
    const trackIndex = tracksToPlay.findIndex(({ trackUrl }) => trackUrl === currentTrackUrl);
    const nextTrackUrl = tracksToPlay[trackIndex + 1]?.trackUrl as TrackUrl;

    if (nextTrackUrl) {
      setActiveTrackUrl(nextTrackUrl);
      playAyat(nextTrackUrl);
      return;
    }
    if (shouldRepeat) {
      const firstTrackUrl = tracksToPlay[0].trackUrl;
      setActiveTrackUrl(firstTrackUrl);
      playAyat(firstTrackUrl);
      return;
    }
    setIsPlaying(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
  }, [activeTrackUrl, tracksToPlay, playAyat, shouldRepeat]);

  const handleAyatClick = useCallback(
    (trackUrl: TrackUrl) => {
      handleStopAll();
      setActiveTrackUrl(trackUrl);
      handlePlay({ activeTrackUrl: trackUrl });
    },
    [handlePlay, handleStopAll]
  );

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
      if (!document.hidden && isPlaying) {
        const audioRef = audioPlayerRef.current;
        if (audioRef && audioRef.paused) {
          audioRef.play().catch(console.error);
        }
      }
    };

    const handleFocus = () => {
      if (isPlaying) {
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
  }, [isPlaying, activeTrackUrl]);

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
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        if (activeTrackUrl) {
          playAyat(activeTrackUrl);
        }
      });
      navigator.mediaSession.setActionHandler("pause", handlePause);
      navigator.mediaSession.setActionHandler("nexttrack", handleEnded);
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        const trackIndex = tracksToPlay.findIndex(({ trackUrl }) => trackUrl === activeTrackUrl);
        if (trackIndex > 0) {
          const prevTrackUrl = tracksToPlay[trackIndex - 1]?.trackUrl;
          setActiveTrackUrl(prevTrackUrl);
          playAyat(prevTrackUrl);
        }
      });
    }
    
    return () => {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
      }
    };
  }, [activeTrackUrl, tracksToPlay, playAyat, handleEnded]);

  return {
    // State
    isPlaying,
    setIsPlaying,
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
    handleEnded,
    handleAyatClick,
  };
};

export default useQuranPlayer;

