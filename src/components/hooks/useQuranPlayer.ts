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

  const initializeAudioSession = async () => {
    await audioSessionManager.current.initialize();
  };

  const playAyat = useCallback(async (trackUrl: TrackUrl) => {
    try {
      // Don't await initializeAudioSession - relying on synchronous audio play 
      // is critical for mobile background playback.
      initializeAudioSession();
      const audioRef = audioPlayerRef.current;
      if (!audioRef) return;

      // Only load new src if track changes
      if (!audioRef.src.includes(trackUrl)) {
        audioRef.src = trackUrl;
        audioRef.setAttribute("data-trackurl", trackUrl);
        audioRef.load();
      }

      // Do NOT await canplaythrough as this breaks the synchronous user-interaction
      // chain required by mobile browsers for background audio playback.
      // Calling play() will automatically wait for sufficient data.
      audioRef.setAttribute("playsinline", "true");
      audioRef.setAttribute("webkit-playsinline", "true");
      
      const playPromise = audioRef.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.error("Error playing audio background:", e);
          setIsPlaying(false);
          // Optional retry logic could be added here
        });
      }
      setIsPlaying(true);

      // We handle scrolling in a separate effect or based on the active row now,
      // since there is only one global audio element.
      const activeElement = document.getElementById(trackUrl);
      if (activeElement) {
        if (activeElement.previousElementSibling) {
          activeElement.previousElementSibling.scrollIntoView();
        } else {
          activeElement.scrollIntoView();
        }
      }

      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title,
          album: surah.name,
          artist: appName,
        });
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
      setTimeout(() => { playAyat(trackUrl); }, 1000);
    }
  }, [surah.name, title]);

  const pauseAyat = useCallback(async () => {
    const audioRef = audioPlayerRef.current;
    if (audioRef) audioRef.pause();
    setIsPlaying(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  }, []);

  const handleStopAll = useCallback(async () => {
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
    async ({ activeTrackUrl }: { activeTrackUrl: TrackUrl }) => {
      try { await playAyat(activeTrackUrl); } catch (e) { console.log(e); }
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

