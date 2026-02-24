import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocalStorage } from "usehooks-ts";
import { appName, surahs } from "../_main/config";
import { type TrackUrl } from "../_main/types";
import AudioSessionManager from "../utils/audioSessionManager";
import AyatList from "./controls/AyatList";
import PlayControls from "./controls/PlayControls";
import { defaultQariKey, type QariKey } from "./controls/qari";
import Header from "./Header";
import { getActiveAyatNumber, getTracksToPlay } from "./utils";

const QuranApp = () => {
  // Single audio element ref — keeps the browser audio session alive across tracks
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeTrackUrlRef = useRef<TrackUrl>("" as TrackUrl);
  const isChangingTrack = useRef(false);
  const audioSessionManager = useRef<AudioSessionManager>(
    AudioSessionManager.getInstance()
  );

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTrackUrl, setActiveTrackUrl] = useState<TrackUrl>(
    "" as TrackUrl
  );
  const [qariKey, setQariKey] = useLocalStorage<QariKey>(
    "qariKey",
    defaultQariKey
  );
  const [surahNumber, setSurahNumber] = useLocalStorage<number>(
    "surahNumber",
    1
  );
  const [ayatRange, setAyatRange] = useLocalStorage<[number, number]>(
    "ayatRange",
    [1, 1]
  );
  const [shouldRepeat, setShouldRepeat] = useLocalStorage<boolean>(
    "shouldRepeat",
    true
  );

  // Keep ref in sync with state so event handlers always see latest value
  useEffect(() => {
    activeTrackUrlRef.current = activeTrackUrl;
  }, [activeTrackUrl]);

  const surah = useMemo(() => {
    return surahs[surahNumber - 1];
  }, [surahNumber]);

  const tracksToPlay = useMemo(() => {
    return getTracksToPlay(ayatRange, shouldRepeat, surahNumber, qariKey);
  }, [ayatRange, shouldRepeat, surahNumber, qariKey]);

  const activeAyatNumber = useMemo(() => {
    return getActiveAyatNumber(activeTrackUrl);
  }, [activeTrackUrl]);

  const title = useMemo(() => {
    return `${surah.name} - Ayat ${activeAyatNumber} / ${surah.numberOfAyats}`;
  }, [surah.name, activeAyatNumber, surah.numberOfAyats]);

  // Play a track by setting src on the single audio element.
  // Because we reuse the same element, the browser's audio session stays active
  // even when the screen is off or phone is locked.
  const playAyat = useCallback(async (trackUrl: TrackUrl) => {
    try {
      await audioSessionManager.current.initialize();

      const audio = audioRef.current;
      if (!audio) return;

      isChangingTrack.current = true;
      audio.src = trackUrl;

      await audio.play();
      isChangingTrack.current = false;
      setIsPlaying(true);

      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    } catch (error) {
      isChangingTrack.current = false;
      console.error("Error playing audio:", error);
      setIsPlaying(false);
    }
  }, []);

  const pauseAyat = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    setIsPlaying(false);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  }, []);

  // When a track ends, advance to the next one on the SAME audio element.
  // This is the critical fix for background playback — mobile browsers allow
  // continued playback on an element that already has an active audio session,
  // but block .play() on a *different* element without a user gesture.
  const handleEnded = useCallback(() => {
    const currentUrl = activeTrackUrlRef.current;
    const idx = tracksToPlay.findIndex((t) => t.trackUrl === currentUrl);
    const nextTrack = tracksToPlay[idx + 1];

    if (nextTrack) {
      setActiveTrackUrl(nextTrack.trackUrl);
      playAyat(nextTrack.trackUrl);
    } else if (shouldRepeat) {
      const first = tracksToPlay[0].trackUrl;
      setActiveTrackUrl(first);
      playAyat(first);
    } else {
      setIsPlaying(false);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
      }
    }
  }, [tracksToPlay, shouldRepeat, playAyat]);

  const handlePlay = useCallback(
    async ({ activeTrackUrl }: { activeTrackUrl: TrackUrl }) => {
      try {
        await playAyat(activeTrackUrl);
      } catch (e) {
        console.log(e);
      }
    },
    [playAyat]
  );

  const handlePause = () => pauseAyat();

  const handleReset = () => {
    handleStopAll();
    const firstTrackUrl: TrackUrl = tracksToPlay[0].trackUrl;
    setActiveTrackUrl(firstTrackUrl);
    handlePlay({ activeTrackUrl: firstTrackUrl });
  };

  const handleStopAll = useCallback(() => {
    setIsPlaying(false);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load(); // reset the element
    }

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
  }, []);

  const handleAyatClick = useCallback(
    (trackUrl: TrackUrl) => {
      handleStopAll();
      setActiveTrackUrl(trackUrl);
      handlePlay({ activeTrackUrl: trackUrl });
    },
    [handlePlay, handleStopAll]
  );

  // Reset when tracks change (surah/range/qari selection changed)
  useEffect(() => {
    if (!tracksToPlay.length) return;
    handleStopAll();
    setActiveTrackUrl(tracksToPlay[0].trackUrl);
  }, [tracksToPlay, handleStopAll]);

  // Update document title
  useEffect(() => {
    document.title = `${title} - ${appName}`;
  }, [title]);

  // Update Media Session metadata when the active track changes.
  // This shows the current ayat info on the lock screen / notification area.
  useEffect(() => {
    if ("mediaSession" in navigator && activeTrackUrl) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${surah.name} - Ayat ${activeAyatNumber}`,
        artist: appName,
        album: surah.name,
      });
    }
  }, [activeTrackUrl, surah.name, activeAyatNumber]);

  // Set up Media Session action handlers for lock screen controls
  // (play/pause/next/previous buttons shown on lock screen & notification shade)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      const audio = audioRef.current;
      if (audio && audio.src) {
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
            navigator.mediaSession.playbackState = "playing";
          })
          .catch(console.error);
      }
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      pauseAyat();
    });

    navigator.mediaSession.setActionHandler("stop", () => {
      handleStopAll();
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      const currentUrl = activeTrackUrlRef.current;
      const idx = tracksToPlay.findIndex((t) => t.trackUrl === currentUrl);
      if (idx > 0) {
        const prevTrack = tracksToPlay[idx - 1].trackUrl;
        setActiveTrackUrl(prevTrack);
        playAyat(prevTrack);
      }
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      const currentUrl = activeTrackUrlRef.current;
      const idx = tracksToPlay.findIndex((t) => t.trackUrl === currentUrl);
      if (idx < tracksToPlay.length - 1) {
        const nextTrack = tracksToPlay[idx + 1].trackUrl;
        setActiveTrackUrl(nextTrack);
        playAyat(nextTrack);
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [tracksToPlay, playAyat, pauseAyat, handleStopAll]);

  // When the page becomes visible again, resume playback if it was interrupted
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isPlaying) {
        const audio = audioRef.current;
        if (audio && audio.paused) {
          audio.play().catch(console.error);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isPlaying]);

  // Initialize audio session on mount
  useEffect(() => {
    audioSessionManager.current.initialize();
  }, []);

  const [startingAyatNumber] = ayatRange;

  return (
    <div className="flex h-screen mx-auto w-full max-w-md flex-col bg-white">
      <Header appName={appName} />
      <div className="p-4 flex-grow overflow-hidden flex gap-2 flex-col ">
        <PlayControls
          qariKey={qariKey}
          setQariKey={setQariKey}
          ayatRange={ayatRange}
          setAyatRange={setAyatRange}
          surah={surah}
          surahNumber={surahNumber}
          setSurahNumber={setSurahNumber}
        />
        {/* Single audio element — keeps the browser audio session alive for
            background & lock-screen playback. Source is swapped on track change. */}
        <audio
          ref={audioRef}
          preload="auto"
          playsInline
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            // Ignore pause events fired when we're changing the src between tracks
            if (!isChangingTrack.current) {
              setIsPlaying(false);
            }
          }}
        />
        <AyatList
          tracksToPlay={tracksToPlay}
          activeTrackUrl={activeTrackUrl}
          activeAyatNumber={activeAyatNumber}
          handleAyatClick={handleAyatClick}
          isPlaying={isPlaying}
        />
        <div className="flex gap-3 justify-between">
          <label className="flex gap-2" htmlFor="shouldRepeat">
            <input
              type="checkbox"
              name="shouldRepeat"
              id="shouldRepeat"
              checked={shouldRepeat}
              onChange={() => setShouldRepeat(!shouldRepeat)}
            />
            Repeat
          </label>
          <div>Current ayat #{activeAyatNumber}</div>
        </div>
      </div>
      <div className="inline-flex shadow-sm" role="group">
        {!isPlaying && (
          <button
            className="btn bg-primary font-bold text-xl text-white w-full p-3"
            onClick={() => handlePlay({ activeTrackUrl: activeTrackUrl })}
          >
            Play
          </button>
        )}
        {isPlaying && (
          <button
            className="btn bg-primary font-bold text-xl text-white w-full p-3"
            onClick={handlePause}
          >
            Pause
          </button>
        )}
        {activeAyatNumber > startingAyatNumber && (
          <button
            className="btn bg-secondary font-bold text-xl text-white p-3"
            onClick={handleReset}
          >
            Restart
          </button>
        )}
      </div>
    </div>
  );
};

export default QuranApp;
