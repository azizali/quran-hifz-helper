import {
    createRef,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type RefObject,
    type SyntheticEvent,
} from "react";
import { useLocalStorage } from "usehooks-ts";
import { appName, surahs } from "../../_main/config";
import { type TrackUrl } from "../../_main/types";
import AudioSessionManager from "../../utils/audioSessionManager";
import { defaultQariKey, type QariKey } from "../controls/qari";
import { getActiveAyatNumber, getTracksToPlay } from "../utils";

const useQuranPlayer = () => {
  const audioPlayerRef = useRef<{
    [key: TrackUrl]: RefObject<HTMLAudioElement>;
  }>({});
  const audioSessionManager = useRef<AudioSessionManager>(AudioSessionManager.getInstance());
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTrackUrl, setActiveTrackUrl] = useState<TrackUrl>("" as TrackUrl);
  const [qariKey, setQariKey] = useLocalStorage<QariKey>("qariKey", defaultQariKey);
  const [surahNumber, setSurahNumber] = useLocalStorage<number>("surahNumber", 1);
  const [ayatRange, setAyatRange] = useLocalStorage<[number, number]>("ayatRange", [1, 1]);
  const [shouldRepeat, setShouldRepeat] = useLocalStorage<boolean>("shouldRepeat", true);

  const surah = useMemo(() => surahs[surahNumber - 1], [surahNumber]);

  const tracksToPlay = useMemo(() => {
    const tracksObjects = getTracksToPlay(ayatRange, shouldRepeat, surahNumber, qariKey);
    tracksObjects.forEach((trackObject) => {
      audioPlayerRef.current[trackObject.trackUrl] = createRef();
    });
    return tracksObjects;
  }, [ayatRange, shouldRepeat, surahNumber, qariKey]);

  const activeAyatNumber = useMemo(() => getActiveAyatNumber(activeTrackUrl), [activeTrackUrl]);

  const title = useMemo(
    () => `${surah.name} - Ayat ${activeAyatNumber} / ${surah.numberOfAyats}`,
    [surah.name, activeAyatNumber, surah.numberOfAyats]
  );

  const initializeAudioSession = async () => {
    await audioSessionManager.current.initialize();
  };

  const playAyat = useCallback(async (trackUrl: TrackUrl) => {
    try {
      await initializeAudioSession();
      const audioRef = audioPlayerRef.current[trackUrl].current as HTMLAudioElement;

      if (audioRef.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
        await new Promise((resolve) => {
          audioRef.addEventListener("canplaythrough", resolve, { once: true });
          audioRef.load();
        });
      }

      audioRef.setAttribute("playsinline", "true");
      audioRef.setAttribute("webkit-playsinline", "true");
      await audioRef.play();
      setIsPlaying(true);

      const parentElement = audioRef.parentElement as Element;
      if (parentElement.previousElementSibling) {
        parentElement.previousElementSibling.scrollIntoView();
      } else {
        parentElement.scrollIntoView();
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
  }, [surah.name]);

  const pauseAyat = async (trackUrl: TrackUrl) => {
    const audioRef = audioPlayerRef.current[trackUrl].current as HTMLAudioElement;
    audioRef.pause();
    setIsPlaying(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  };

  const handleStopAll = useCallback(async () => {
    setIsPlaying(false);
    const tracks = Object.keys(audioPlayerRef.current) as Array<TrackUrl>;
    tracks.forEach((track) => {
      const elm = audioPlayerRef.current[track]?.current;
      if (!elm) return;
      elm.pause();
      elm.currentTime = 0;
    });
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

  const handlePause = () => pauseAyat(activeTrackUrl);

  const handleReset = () => {
    handleStopAll();
    const firstTrackUrl: TrackUrl = tracksToPlay[0].trackUrl;
    setActiveTrackUrl(firstTrackUrl);
    handlePlay({ activeTrackUrl: firstTrackUrl });
  };

  const handleEnded = async (e: SyntheticEvent) => {
    const currentTrackUrl = (e.target as HTMLElement).id;
    const trackIndex = tracksToPlay.findIndex(({ trackUrl }) => trackUrl === currentTrackUrl);
    const nextTrackUrl = tracksToPlay[trackIndex + 1]?.trackUrl as TrackUrl;

    if (nextTrackUrl) {
      setActiveTrackUrl(nextTrackUrl);
      await playAyat(nextTrackUrl);
      return;
    }
    if (shouldRepeat) {
      const firstTrackUrl = tracksToPlay[0].trackUrl;
      setActiveTrackUrl(firstTrackUrl);
      await playAyat(firstTrackUrl);
      return;
    }
    setIsPlaying(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
  };

  const handleAyatClick = useCallback(
    (trackUrl: TrackUrl) => {
      handleStopAll();
      setActiveTrackUrl(trackUrl);
      handlePlay({ activeTrackUrl: trackUrl });
    },
    [handlePlay, handleStopAll]
  );

  // Reset tracks when tracksToPlay changes
  useEffect(() => {
    if (!tracksToPlay.length) return;
    handleStopAll();
    setActiveTrackUrl(tracksToPlay[0].trackUrl);
  }, [tracksToPlay, handleStopAll]);

  // Update document title
  useEffect(() => {
    document.title = `${title} - ${appName}`;
  }, [title]);

  // Handle page visibility changes to prevent audio stopping
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isPlaying) {
        const audioRef = audioPlayerRef.current[activeTrackUrl]?.current;
        if (audioRef && audioRef.paused) {
          audioRef.play().catch(console.error);
        }
      }
    };

    const handleFocus = () => {
      if (isPlaying) {
        const audioRef = audioPlayerRef.current[activeTrackUrl]?.current;
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

