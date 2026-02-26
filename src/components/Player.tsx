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

/**
 * Double-buffered audio player.
 *
 * Two <audio> elements (A and B) alternate roles:
 *   - The "active" element is the one currently producing sound.
 *   - The "pending" element silently preloads the *next* track.
 *
 * When the active element fires `ended`, we instantly `.play()` on the
 * pending element (already buffered → no network wait) and start preloading
 * the track after that on the now-idle element.
 *
 * This eliminates the fetch/buffer gap that caused mobile browsers to
 * consider the audio session idle and suspend the page while the screen
 * was off.
 */
const QuranApp = () => {
  const audioRefA = useRef<HTMLAudioElement>(null);
  const audioRefB = useRef<HTMLAudioElement>(null);

  // Which element is currently playing: "A" or "B"
  const activeElement = useRef<"A" | "B">("A");
  const activeTrackUrlRef = useRef<TrackUrl>("" as TrackUrl);
  const tracksRef = useRef<ReturnType<typeof getTracksToPlay>>([]);
  const shouldRepeatRef = useRef(true);
  const isPlayingRef = useRef(false);

  const audioSessionManager = useRef<AudioSessionManager>(
    AudioSessionManager.getInstance()
  );

  const [isPlaying, setIsPlaying] = useState(false);
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

  // Keep refs in sync so event handlers always see latest values
  useEffect(() => {
    activeTrackUrlRef.current = activeTrackUrl;
  }, [activeTrackUrl]);

  const surah = useMemo(() => surahs[surahNumber - 1], [surahNumber]);

  const tracksToPlay = useMemo(
    () => getTracksToPlay(ayatRange, shouldRepeat, surahNumber, qariKey),
    [ayatRange, shouldRepeat, surahNumber, qariKey]
  );

  // Keep refs in sync
  useEffect(() => {
    tracksRef.current = tracksToPlay;
  }, [tracksToPlay]);
  useEffect(() => {
    shouldRepeatRef.current = shouldRepeat;
  }, [shouldRepeat]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const activeAyatNumber = useMemo(
    () => getActiveAyatNumber(activeTrackUrl),
    [activeTrackUrl]
  );

  const title = useMemo(
    () => `${surah.name} - Ayat ${activeAyatNumber} / ${surah.numberOfAyats}`,
    [surah.name, activeAyatNumber, surah.numberOfAyats]
  );

  // ── helpers ──────────────────────────────────────────────────────────

  const getActiveAudio = useCallback(
    () =>
      activeElement.current === "A"
        ? audioRefA.current!
        : audioRefB.current!,
    []
  );

  const getPendingAudio = useCallback(
    () =>
      activeElement.current === "A"
        ? audioRefB.current!
        : audioRefA.current!,
    []
  );

  /** Preload the next track on the idle (pending) audio element. */
  const preloadNext = useCallback((currentTrackUrl: TrackUrl) => {
    const tracks = tracksRef.current;
    const idx = tracks.findIndex((t) => t.trackUrl === currentTrackUrl);
    let nextUrl: TrackUrl | null = null;

    if (idx < tracks.length - 1) {
      nextUrl = tracks[idx + 1].trackUrl;
    } else if (shouldRepeatRef.current && tracks.length > 0) {
      nextUrl = tracks[0].trackUrl;
    }

    if (nextUrl) {
      const pending = getPendingAudio();
      if (pending) {
        pending.src = nextUrl;
        pending.preload = "auto";
        pending.load(); // start buffering
      }
    }
  }, [getPendingAudio]);

  /**
   * Also prefetch a few upcoming audio files into the Cache API / service
   * worker cache so that even the preload <audio> hits cache instead of
   * the network.
   */
  const prefetchUpcoming = useCallback((currentTrackUrl: TrackUrl) => {
    const tracks = tracksRef.current;
    const idx = tracks.findIndex((t) => t.trackUrl === currentTrackUrl);
    // Prefetch next 3 tracks
    const toFetch = tracks.slice(idx + 1, idx + 4).map((t) => t.trackUrl);

    if ("caches" in window && toFetch.length) {
      caches.open("audio-cache").then((cache) => {
        toFetch.forEach((url) => {
          cache.match(url).then((hit) => {
            if (!hit) {
              fetch(url, { mode: "cors" })
                .then((resp) => {
                  if (resp.ok) cache.put(url, resp);
                })
                .catch(() => {});
            }
          });
        });
      });
    }
  }, []);

  // ── playback controls ────────────────────────────────────────────────

  const playAyat = useCallback(
    async (trackUrl: TrackUrl) => {
      try {
        await audioSessionManager.current.initialize();

        const audio = getActiveAudio();
        if (!audio) return;

        // If the pending element already has this track loaded, swap to it
        const pending = getPendingAudio();
        if (pending && pending.src && pending.src === trackUrl) {
          activeElement.current = activeElement.current === "A" ? "B" : "A";
          // Now getActiveAudio() returns the element that has the track
          const ready = getActiveAudio();
          await ready.play();
        } else {
          audio.src = trackUrl;
          await audio.play();
        }

        setIsPlaying(true);
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }

        // Start preloading the next track on the idle element
        preloadNext(trackUrl);
        // Also prefetch a few upcoming tracks into Cache API
        prefetchUpcoming(trackUrl);
      } catch (error) {
        console.error("Error playing audio:", error);
        setIsPlaying(false);
      }
    },
    [getActiveAudio, getPendingAudio, preloadNext, prefetchUpcoming]
  );

  const pauseAyat = useCallback(() => {
    const audio = getActiveAudio();
    if (audio) audio.pause();
    setIsPlaying(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  }, [getActiveAudio]);

  /**
   * Core playlist advancement.
   * Called when the active element fires `ended`.
   * The pending element already has the next track buffered — just swap & play.
   */
  const advanceToNext = useCallback(() => {
    const currentUrl = activeTrackUrlRef.current;
    const tracks = tracksRef.current;
    const idx = tracks.findIndex((t) => t.trackUrl === currentUrl);
    let nextUrl: TrackUrl | null = null;

    if (idx < tracks.length - 1) {
      nextUrl = tracks[idx + 1].trackUrl;
    } else if (shouldRepeatRef.current && tracks.length > 0) {
      nextUrl = tracks[0].trackUrl;
    }

    if (!nextUrl) {
      setIsPlaying(false);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
      }
      return;
    }

    // Swap active/pending
    activeElement.current = activeElement.current === "A" ? "B" : "A";
    const nowActive = getActiveAudio();

    // The pending element should already have nextUrl loaded.
    // If for some reason it doesn't (cache miss, race condition), set it now.
    if (!nowActive.src || nowActive.src !== nextUrl) {
      nowActive.src = nextUrl;
    }

    setActiveTrackUrl(nextUrl);

    nowActive
      .play()
      .then(() => {
        setIsPlaying(true);
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
        // Preload the track after this one on the now-idle element
        preloadNext(nextUrl!);
        prefetchUpcoming(nextUrl!);
      })
      .catch((err) => {
        console.error("Error advancing track:", err);
        setIsPlaying(false);
      });
  }, [getActiveAudio, preloadNext, prefetchUpcoming]);

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

  const handleStopAll = useCallback(() => {
    setIsPlaying(false);
    [audioRefA.current, audioRefB.current].forEach((audio) => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute("src");
        audio.load();
      }
    });
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
  }, []);

  const handleReset = () => {
    handleStopAll();
    activeElement.current = "A";
    const firstTrackUrl: TrackUrl = tracksToPlay[0].trackUrl;
    setActiveTrackUrl(firstTrackUrl);
    handlePlay({ activeTrackUrl: firstTrackUrl });
  };

  const handleAyatClick = useCallback(
    (trackUrl: TrackUrl) => {
      handleStopAll();
      activeElement.current = "A";
      setActiveTrackUrl(trackUrl);
      handlePlay({ activeTrackUrl: trackUrl });
    },
    [handlePlay, handleStopAll]
  );

  // ── effects ──────────────────────────────────────────────────────────

  // Reset when track list changes (surah / range / qari changed)
  useEffect(() => {
    if (!tracksToPlay.length) return;
    handleStopAll();
    activeElement.current = "A";
    setActiveTrackUrl(tracksToPlay[0].trackUrl);
  }, [tracksToPlay, handleStopAll]);

  // Update document title
  useEffect(() => {
    document.title = `${title} - ${appName}`;
  }, [title]);

  // Update Media Session metadata on track change
  useEffect(() => {
    if ("mediaSession" in navigator && activeTrackUrl) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${surah.name} - Ayat ${activeAyatNumber}`,
        artist: appName,
        album: surah.name,
      });
    }
  }, [activeTrackUrl, surah.name, activeAyatNumber]);

  // Media Session action handlers (lock screen controls)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      const audio = getActiveAudio();
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

    navigator.mediaSession.setActionHandler("pause", () => pauseAyat());
    navigator.mediaSession.setActionHandler("stop", () => handleStopAll());

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      const currentUrl = activeTrackUrlRef.current;
      const idx = tracksRef.current.findIndex(
        (t) => t.trackUrl === currentUrl
      );
      if (idx > 0) {
        const prev = tracksRef.current[idx - 1].trackUrl;
        handleStopAll();
        activeElement.current = "A";
        setActiveTrackUrl(prev);
        playAyat(prev);
      }
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      advanceToNext();
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [playAyat, pauseAyat, handleStopAll, advanceToNext, getActiveAudio]);

  // When page becomes visible again, resume if interrupted
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isPlayingRef.current) {
        const audio = getActiveAudio();
        if (audio && audio.paused && audio.src) {
          audio.play().catch(console.error);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [getActiveAudio]);

  // Initialize audio session on mount
  useEffect(() => {
    audioSessionManager.current.initialize();
  }, []);

  // ── render ───────────────────────────────────────────────────────────

  const [startingAyatNumber] = ayatRange;

  /**
   * Shared `onEnded` handler wired to both audio elements.
   * Only the *active* element should trigger advancement; the pending
   * element reaching ended is a no-op (shouldn't happen normally).
   */
  const onEndedA = useCallback(() => {
    if (activeElement.current === "A") advanceToNext();
  }, [advanceToNext]);

  const onEndedB = useCallback(() => {
    if (activeElement.current === "B") advanceToNext();
  }, [advanceToNext]);

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
        {/*
          Double-buffered audio elements.
          A and B alternate: one plays while the other preloads the next track.
          This prevents the fetch/buffer gap that caused mobile browsers to
          kill the audio session when the screen was off.
        */}
        <audio ref={audioRefA} preload="auto" playsInline onEnded={onEndedA} />
        <audio ref={audioRefB} preload="auto" playsInline onEnded={onEndedB} />
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
