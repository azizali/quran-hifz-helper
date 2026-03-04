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
 * Concatenated-blob audio player.
 *
 * Instead of separate <audio> elements per ayat (which causes mobile browsers
 * to suspend the page during JavaScript-mediated track transitions), this
 * player:
 *
 *   1. Fetches every MP3 file for the selected ayat range
 *   2. Concatenates the raw bytes into a single Blob  (MP3 frames are
 *      self-contained so raw concatenation produces a valid stream)
 *   3. Plays the blob on ONE <audio> element
 *
 * The browser sees a single continuous audio file — zero gaps between ayats,
 * zero JavaScript needed between tracks, and the OS audio session never
 * drops, even with the screen off and phone locked.
 */

interface TrackSegment {
  trackUrl: TrackUrl;
  byteOffset: number;
  byteLength: number;
  startTime: number;
  endTime: number;
}

const QuranApp = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const segmentsRef = useRef<TrackSegment[]>([]);
  const totalBytesRef = useRef(0);
  const activeTrackUrlRef = useRef<TrackUrl>("" as TrackUrl);
  const shouldRepeatRef = useRef(true);
  const userWantsToPlayRef = useRef(false);
  const loadingRef = useRef(false);
  const currentBlobCacheKey = useRef<string | null>(null);
  const audioSessionManager = useRef(AudioSessionManager.getInstance());

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  // Keep refs in sync so event handlers always read the latest value
  useEffect(() => {
    activeTrackUrlRef.current = activeTrackUrl;
  }, [activeTrackUrl]);
  useEffect(() => {
    shouldRepeatRef.current = shouldRepeat;
  }, [shouldRepeat]);

  const surah = useMemo(() => surahs[surahNumber - 1], [surahNumber]);

  const tracksToPlay = useMemo(
    () => getTracksToPlay(ayatRange, shouldRepeat, surahNumber, qariKey),
    [ayatRange, shouldRepeat, surahNumber, qariKey]
  );

  const activeAyatNumber = useMemo(
    () => getActiveAyatNumber(activeTrackUrl),
    [activeTrackUrl]
  );

  const title = useMemo(
    () => `${surah.name} - Ayat ${activeAyatNumber} / ${surah.numberOfAyats}`,
    [surah.name, activeAyatNumber, surah.numberOfAyats]
  );

  // ── helpers ──────────────────────────────────────────────────────────

  /** Deterministic cache key for a set of tracks — same tracks always = same key. */
  const blobCacheKey = useCallback(
    (tracks: ReturnType<typeof getTracksToPlay>) =>
      "playlist-blob:" + tracks.map((t) => t.trackUrl).join("|"),
    []
  );

  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  /** Fetch an audio file, trying the Cache API first. */
  const fetchAudio = useCallback(async (url: string): Promise<ArrayBuffer> => {
    if ("caches" in window) {
      try {
        const cache = await caches.open("audio-cache");
        const hit = await cache.match(url);
        if (hit) return hit.arrayBuffer();
      } catch {
        /* cache miss — fall through */
      }
    }

    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) throw new Error(`Fetch failed: ${url} (${resp.status})`);

    if ("caches" in window) {
      try {
        const cache = await caches.open("audio-cache");
        cache.put(url, resp.clone());
      } catch {
        /* ignore */
      }
    }

    return resp.arrayBuffer();
  }, []);

  /**
   * Build (or retrieve from cache) a single MP3 blob for the playlist.
   *
   * The concatenated blob is stored in the Cache API under a deterministic
   * key derived from the track URLs.  On subsequent plays with the same
   * ayat range / qari, the blob is loaded straight from cache — no
   * re-fetching or re-concatenating.
   */
  const buildPlaylistBlob = useCallback(
    async (tracks: ReturnType<typeof getTracksToPlay>) => {
      const cacheKey = blobCacheKey(tracks);

      // ── Try the cache first ──────────────────────────────────────────
      if ("caches" in window) {
        try {
          const cache = await caches.open("playlist-blob-cache");
          const hit = await cache.match(cacheKey);
          if (hit) {
            const buf = await hit.arrayBuffer();

            // Rebuild segment metadata from per-track sizes stored in a header.
            const headerResp = await cache.match(cacheKey + ":meta");
            if (headerResp) {
              const meta = await headerResp.json() as { sizes: number[] };
              const segments: TrackSegment[] = [];
              let offset = 0;
              for (let i = 0; i < tracks.length; i++) {
                const byteLen = meta.sizes[i] ?? 0;
                segments.push({
                  trackUrl: tracks[i].trackUrl,
                  byteOffset: offset,
                  byteLength: byteLen,
                  startTime: 0,
                  endTime: 0,
                });
                offset += byteLen;
              }

              const blob = new Blob([new Uint8Array(buf)], { type: "audio/mpeg" });
              currentBlobCacheKey.current = cacheKey;
              return {
                blobUrl: URL.createObjectURL(blob),
                segments,
                totalBytes: offset,
              };
            }
          }
        } catch {
          /* cache miss — fall through to build */
        }
      }

      // ── Build from individual tracks ─────────────────────────────────
      const fetched = await Promise.all(
        tracks.map(async (t) => ({
          trackUrl: t.trackUrl,
          buffer: await fetchAudio(t.trackUrl),
        }))
      );

      const segments: TrackSegment[] = [];
      let offset = 0;
      for (const { trackUrl, buffer } of fetched) {
        segments.push({
          trackUrl,
          byteOffset: offset,
          byteLength: buffer.byteLength,
          startTime: 0,
          endTime: 0,
        });
        offset += buffer.byteLength;
      }

      const blob = new Blob(
        fetched.map((f) => new Uint8Array(f.buffer)),
        { type: "audio/mpeg" }
      );

      // ── Store in cache for next time ─────────────────────────────────
      if ("caches" in window) {
        try {
          const cache = await caches.open("playlist-blob-cache");
          await cache.put(
            cacheKey,
            new Response(blob.slice(0), {
              headers: { "Content-Type": "audio/mpeg" },
            })
          );
          // Store per-track byte sizes so we can rebuild segments later
          await cache.put(
            cacheKey + ":meta",
            new Response(
              JSON.stringify({ sizes: fetched.map((f) => f.buffer.byteLength) }),
              { headers: { "Content-Type": "application/json" } }
            )
          );
        } catch {
          /* non-critical */
        }
      }

      currentBlobCacheKey.current = cacheKey;
      return {
        blobUrl: URL.createObjectURL(blob),
        segments,
        totalBytes: offset,
      };
    },
    [fetchAudio, blobCacheKey]
  );

  /**
   * Convert byte-offset segments to time-offset segments using the audio's
   * real duration (available after `loadedmetadata`). Uses a byte-proportional
   * estimate — accurate for CBR, close enough for VBR/UI purposes.
   */
  const finalizeSegments = useCallback(
    (segments: TrackSegment[], totalBytes: number, totalDuration: number) => {
      let t = 0;
      for (const seg of segments) {
        seg.startTime = t;
        const segDuration = (seg.byteLength / totalBytes) * totalDuration;
        seg.endTime = t + segDuration;
        t = seg.endTime;
      }
    },
    []
  );

  /** Find which segment `currentTime` falls in. */
  const segmentAtTime = useCallback((time: number): TrackSegment | null => {
    const segs = segmentsRef.current;
    for (let i = segs.length - 1; i >= 0; i--) {
      if (time >= segs[i].startTime - 0.05) return segs[i];
    }
    return segs[0] ?? null;
  }, []);

  // ── playback controls ────────────────────────────────────────────────

  const startPlayback = useCallback(
    async (seekToTrackUrl?: TrackUrl) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setIsLoading(true);

      try {
        await audioSessionManager.current.initialize();
        audioSessionManager.current.startKeepalive();

        const { blobUrl, segments, totalBytes } =
          await buildPlaylistBlob(tracksToPlay);

        cleanupBlobUrl();
        blobUrlRef.current = blobUrl;
        totalBytesRef.current = totalBytes;

        const audio = audioRef.current;
        if (!audio) return;

        audio.src = blobUrl;
        audio.loop = shouldRepeatRef.current;
        await new Promise<void>((resolve, reject) => {
          if (audio.readyState >= 1) {
            resolve();
            return;
          }
          const onMeta = () => {
            audio.removeEventListener("loadedmetadata", onMeta);
            audio.removeEventListener("error", onErr);
            resolve();
          };
          const onErr = () => {
            audio.removeEventListener("loadedmetadata", onMeta);
            audio.removeEventListener("error", onErr);
            reject(new Error("Audio load error"));
          };
          audio.addEventListener("loadedmetadata", onMeta);
          audio.addEventListener("error", onErr);
        });

        // Convert byte offsets → time offsets now that we know total duration
        finalizeSegments(segments, totalBytes, audio.duration);
        segmentsRef.current = segments;

        // Seek to a specific ayat if requested
        if (seekToTrackUrl) {
          const target = segments.find((s) => s.trackUrl === seekToTrackUrl);
          if (target) audio.currentTime = target.startTime;
        }

        const firstUrl =
          seekToTrackUrl ||
          (segments.length > 0 ? segments[0].trackUrl : ("" as TrackUrl));
        setActiveTrackUrl(firstUrl);

        userWantsToPlayRef.current = true;
        await audio.play();
        setIsPlaying(true);

        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
      } catch (err) {
        console.error("Error starting playback:", err);
        setIsPlaying(false);
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [tracksToPlay, buildPlaylistBlob, cleanupBlobUrl, finalizeSegments]
  );

  const resumePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    await audioSessionManager.current.initialize();
    audioSessionManager.current.startKeepalive();
    userWantsToPlayRef.current = true;
    await audio.play();
    setIsPlaying(true);
    if ("mediaSession" in navigator)
      navigator.mediaSession.playbackState = "playing";
  }, []);

  const pausePlayback = useCallback(() => {
    userWantsToPlayRef.current = false;
    const audio = audioRef.current;
    if (audio) audio.pause();
    setIsPlaying(false);
    audioSessionManager.current.stopKeepalive();
    if ("mediaSession" in navigator)
      navigator.mediaSession.playbackState = "paused";
  }, []);

  const handleStopAll = useCallback(() => {
    userWantsToPlayRef.current = false;
    loadingRef.current = false;
    setIsPlaying(false);
    setIsLoading(false);
    audioSessionManager.current.stopKeepalive();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }
    cleanupBlobUrl();
    segmentsRef.current = [];
    if ("mediaSession" in navigator)
      navigator.mediaSession.playbackState = "none";
  }, [cleanupBlobUrl]);

  const handlePlay = useCallback(async () => {
    // If a blob is already loaded, just resume
    if (
      blobUrlRef.current &&
      audioRef.current &&
      audioRef.current.readyState > 0
    ) {
      await resumePlayback();
    } else {
      await startPlayback();
    }
  }, [resumePlayback, startPlayback]);

  const handlePause = useCallback(() => pausePlayback(), [pausePlayback]);

  const handleReset = useCallback(() => {
    handleStopAll();
    startPlayback();
  }, [handleStopAll, startPlayback]);

  const handleAyatClick = useCallback(
    (trackUrl: TrackUrl) => {
      const audio = audioRef.current;

      // If the blob is already loaded, just seek within it
      if (audio && blobUrlRef.current && segmentsRef.current.length > 0) {
        const target = segmentsRef.current.find(
          (s) => s.trackUrl === trackUrl
        );
        if (target) {
          audio.currentTime = target.startTime;
          setActiveTrackUrl(trackUrl);
          if (!userWantsToPlayRef.current) {
            resumePlayback();
          }
          return;
        }
      }

      // Otherwise rebuild the blob starting from that ayat
      handleStopAll();
      startPlayback(trackUrl);
    },
    [resumePlayback, handleStopAll, startPlayback]
  );

  // ── audio event handlers ─────────────────────────────────────────────

  /** Determine which ayat is currently playing based on currentTime. */
  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const seg = segmentAtTime(audio.currentTime);
    if (seg && seg.trackUrl !== activeTrackUrlRef.current) {
      setActiveTrackUrl(seg.trackUrl);

      // Keep the lock-screen / notification controls aware of progress.
      // Updated on each ayat change rather than every timeupdate to avoid
      // excessive calls.
      if ("mediaSession" in navigator && isFinite(audio.duration)) {
        try {
          navigator.mediaSession.setPositionState?.({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime,
          });
        } catch {
          /* ignore */
        }
      }
    }
  }, [segmentAtTime]);

  /**
   * Fires only when repeat is OFF and the playlist truly ends.
   * When repeat is ON, audio.loop handles looping natively inside the
   * browser's media engine — no JS .play() call needed, works even with
   * the screen off.
   */
  const onEnded = useCallback(() => {
    userWantsToPlayRef.current = false;
    setIsPlaying(false);
    audioSessionManager.current.stopKeepalive();
    if ("mediaSession" in navigator)
      navigator.mediaSession.playbackState = "none";
  }, []);

  /**
   * Auto-resume when the browser/OS pauses audio unexpectedly (e.g. incoming
   * call ends, notification sound, or iOS background suspension).
   * Only resumes if the user intended playback to continue.
   */
  const onPause = useCallback(() => {
    if (!userWantsToPlayRef.current) return;
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    // Small delay — let the browser settle (e.g. after an interruption)
    setTimeout(() => {
      if (userWantsToPlayRef.current && audio.paused && audio.src) {
        audioSessionManager.current.ensureAudioContext();
        audio.play().catch(() => {});
      }
    }, 300);
  }, []);

  /**
   * Recovery when audio stalls (e.g. buffer underrun after background).
   */
  const onStalled = useCallback(() => {
    if (!userWantsToPlayRef.current) return;
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    setTimeout(() => {
      if (userWantsToPlayRef.current && audio.paused && audio.src) {
        audioSessionManager.current.ensureAudioContext();
        audio.play().catch(() => {});
      }
    }, 500);
  }, []);

  // ── effects ──────────────────────────────────────────────────────────

  // Reset when track list changes (surah / range / qari changed)
  useEffect(() => {
    if (!tracksToPlay.length) return;
    handleStopAll();
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

  // Media Session action handlers (lock screen / notification controls)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => resumePlayback());
    navigator.mediaSession.setActionHandler("pause", () => pausePlayback());
    navigator.mediaSession.setActionHandler("stop", () => handleStopAll());

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      const segs = segmentsRef.current;
      const idx = segs.findIndex(
        (s) => s.trackUrl === activeTrackUrlRef.current
      );
      if (idx > 0 && audioRef.current) {
        audioRef.current.currentTime = segs[idx - 1].startTime;
        setActiveTrackUrl(segs[idx - 1].trackUrl);
      }
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      const segs = segmentsRef.current;
      const idx = segs.findIndex(
        (s) => s.trackUrl === activeTrackUrlRef.current
      );
      if (idx >= 0 && idx < segs.length - 1 && audioRef.current) {
        audioRef.current.currentTime = segs[idx + 1].startTime;
        setActiveTrackUrl(segs[idx + 1].trackUrl);
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [resumePlayback, pausePlayback, handleStopAll]);

  // Safety net: resume playback when the page becomes visible again
  useEffect(() => {
    const handler = () => {
      if (!document.hidden && userWantsToPlayRef.current) {
        const audio = audioRef.current;
        if (audio && audio.paused && audio.src) {
          audioSessionManager.current.ensureAudioContext();
          audio.play().catch(console.error);
        }

        // Update Media Session position state when coming back to foreground
        if (audio && !audio.paused && isFinite(audio.duration)) {
          try {
            navigator.mediaSession?.setPositionState?.({
              duration: audio.duration,
              playbackRate: audio.playbackRate,
              position: audio.currentTime,
            });
          } catch {
            /* ignore */
          }
        }
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // Watchdog: periodically check if audio should be playing but isn't.
  // Fires every 5 s — throttled in background by the browser but will
  // run once the page regains focus, acting as a second safety net.
  useEffect(() => {
    const id = setInterval(() => {
      if (!userWantsToPlayRef.current) return;
      const audio = audioRef.current;
      if (audio && audio.paused && audio.src) {
        audioSessionManager.current.ensureAudioContext();
        audio.play().catch(() => {});
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Initialize audio session on mount
  useEffect(() => {
    audioSessionManager.current.initialize();
  }, []);

  // When shouldRepeat is toggled mid-playback, sync audio.loop immediately.
  // audio.loop is handled natively by the browser — no JS .play() needed.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.loop = shouldRepeat;
  }, [shouldRepeat]);

  // ── render ───────────────────────────────────────────────────────────

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
        {/*
          Single <audio> element playing a concatenated MP3 blob.
          The browser treats it as one continuous file — no gaps between
          ayats, no JavaScript transitions, and the OS audio session
          stays alive with the screen off.
        */}
        <audio
          ref={audioRef}
          preload="auto"
          playsInline
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          onPause={onPause}
          onStalled={onStalled}
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
        {isLoading ? (
          <button
            className="btn bg-primary font-bold text-xl text-white w-full p-3 opacity-70"
            disabled
          >
            Loading…
          </button>
        ) : !isPlaying ? (
          <button
            className="btn bg-primary font-bold text-xl text-white w-full p-3"
            onClick={handlePlay}
          >
            Play
          </button>
        ) : (
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
