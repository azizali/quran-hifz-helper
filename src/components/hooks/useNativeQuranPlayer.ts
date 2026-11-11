import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useLocalStorage } from "usehooks-ts";
import { appName, surahs } from "../../_main/config";
import type { TrackObject, TrackUrl } from "../../_main/types";
import { getLocalPaths, subscribeToDownloadChanges } from "../../native-audio/downloadManager";
import { NativeQuranAudio, type QueueTrack } from "../../native-audio";
import type { Bookmark, SelectionRange } from "../controls/libraryTypes";
import { defaultQariKey, type QariKey } from "../controls/qari";
import { getActiveAyatNumber, getTracksToPlay } from "../utils";
import { baseTrackUrl, expandForQueue, REPEAT_FOREVER, useRepeatSettings } from "./quranPlayer/repeatSettings";

const PLAYBACK_RATE_STEP = 0.1;
const MIN_PLAYBACK_RATE = 1;
const MAX_PLAYBACK_RATE = 3;

const clampPlaybackRate = (rate: number) => {
  const rounded = Math.round(rate / PLAYBACK_RATE_STEP) * PLAYBACK_RATE_STEP;
  return Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, rounded));
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getSelectionLabel = (selectedSurahNumber: number, selectedAyatRange: SelectionRange) => {
  const selectedSurah = surahs[selectedSurahNumber - 1];
  if (!selectedSurah) return `Surah #${selectedSurahNumber}`;

  const [startAyatNumber, endAyatNumber] = selectedAyatRange;
  const isFullSurah = startAyatNumber === 1 && endAyatNumber === selectedSurah.numberOfAyats;

  if (isFullSurah) return `${selectedSurah.number}. ${selectedSurah.name} (Full Surah)`;
  return `${selectedSurah.number}. ${selectedSurah.name} (Ayat ${startAyatNumber}-${endAyatNumber})`;
};

const scrollTrackIntoView = (trackUrl: string) => {
  const element = document.querySelector(`[data-track-url="${window.CSS.escape(trackUrl)}"]`);
  if (element) {
    const scrollTarget = element.previousElementSibling || element;
    scrollTarget.scrollIntoView({ block: "nearest" });
  }
};

const nullAudioRef: MutableRefObject<HTMLAudioElement | null> = { current: null };

const QUEUE_ERROR_MESSAGE =
  "Failed to load audio. Some tracks may be unavailable or your network is too slow. Please try again.";

const useNativeQuranPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrackUrl, setActiveTrackUrl] = useState<TrackUrl>("" as TrackUrl);
  const [qariKey, setQariKey] = useLocalStorage<QariKey>("qariKey", defaultQariKey);
  const [surahNumber, setSurahNumber] = useLocalStorage<number>("surahNumber", 1);
  const [ayatRange, setAyatRange] = useLocalStorage<[number, number]>("ayatRange", [1, 1]);
  const [bookmarks, setBookmarks] = useLocalStorage<Bookmark[]>("bookmarks", []);
  const { repeat, setEach, setWhole } = useRepeatSettings();
  const [playbackRate, setPlaybackRate] = useLocalStorage<number>("playbackRate", 1);
  const [autoAdvanceSurah, setAutoAdvanceSurah] = useLocalStorage<boolean>("autoAdvanceSurah", false);

  const [isReady, setIsReady] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [preloadProgress] = useState({ loaded: 0, total: 0 });

  const isPlayingRef = useRef(false);
  const activeTrackUrlRef = useRef<TrackUrl>("" as TrackUrl);
  // Queue entry ids (a repeated ayat appears several times) and their tracks.
  const queueEntriesRef = useRef<{ id: string; track: TrackObject }[]>([]);
  const buildIdRef = useRef(0);

  const selectedSurah = useMemo(() => surahs[surahNumber - 1], [surahNumber]);

  const tracksToPlay = useMemo(
    () => getTracksToPlay(ayatRange, surahNumber, qariKey),
    [ayatRange, surahNumber, qariKey]
  );

  const activeAyatNumber = useMemo(() => getActiveAyatNumber(activeTrackUrl), [activeTrackUrl]);
  const activeTrack = useMemo(
    () => tracksToPlay.find((track) => track.trackUrl === activeTrackUrl),
    [tracksToPlay, activeTrackUrl]
  );
  const activeSurah = useMemo(
    () => (activeTrack ? surahs[activeTrack.surahNumber - 1] : selectedSurah),
    [activeTrack, selectedSurah]
  );

  const title = useMemo(
    () => `${activeSurah.name} - Ayat ${activeAyatNumber} / ${activeSurah.numberOfAyats}`,
    [activeSurah.name, activeAyatNumber, activeSurah.numberOfAyats]
  );

  // ─── Build a track list that optionally continues into subsequent surahs ───
  const buildQueueTracks = useCallback(
    (startSurahNumber: number, startAyatRange: SelectionRange): TrackObject[] => {
      const startSurah = surahs[startSurahNumber - 1];
      if (!startSurah) return [];

      let tracks = getTracksToPlay(startAyatRange, startSurahNumber, qariKey);

      if (autoAdvanceSurah) {
        let nextSurahNumber = startSurahNumber + 1;
        while (nextSurahNumber <= surahs.length) {
          const nextSurah = surahs[nextSurahNumber - 1];
          tracks = tracks.concat(
            getTracksToPlay([1, nextSurah.numberOfAyats], nextSurahNumber, qariKey)
          );
          nextSurahNumber++;
        }
      }

      return tracks;
    },
    [qariKey, autoAdvanceSurah]
  );

  const buildAndSetQueue = useCallback(
    async (requestedStartIndex = 0, keepTrackUrl?: TrackUrl) => {
      const thisBuildId = ++buildIdRef.current;
      setIsReady(false);
      setBuildError(null);

      try {
        const tracks = buildQueueTracks(surahNumber, ayatRange);
        if (tracks.length === 0) return;

        const localPaths = await getLocalPaths();
        const entries = expandForQueue(tracks, repeat, !autoAdvanceSurah);
        const queueTracks: QueueTrack[] = entries.map(({ id, track }) => {
          const surah = surahs[track.surahNumber - 1];
          return {
            id,
            url: track.trackUrl,
            localPath: localPaths.get(track.trackUrl),
            title: `${surah.name} - Ayat ${track.ayatNumber} / ${surah.numberOfAyats}`,
            album: surah.name,
            artist: appName,
          };
        });

        if (buildIdRef.current !== thisBuildId) return;

        const keptIndex = keepTrackUrl
          ? entries.findIndex(({ track }) => track.trackUrl === keepTrackUrl)
          : -1;
        const startIndex = keptIndex >= 0 ? keptIndex : requestedStartIndex;

        queueEntriesRef.current = entries;

        await NativeQuranAudio.setQueue({
          tracks: queueTracks,
          startIndex,
          playbackRate,
        });

        if (buildIdRef.current !== thisBuildId) return;

        const activeTrack = (entries[startIndex] ?? entries[0]).track;
        activeTrackUrlRef.current = activeTrack.trackUrl;
        setActiveTrackUrl(activeTrack.trackUrl);
        setIsReady(true);
      } catch (error) {
        console.error("Failed to build native queue:", error);
        setBuildError(QUEUE_ERROR_MESSAGE);
      }
    },
    [surahNumber, ayatRange, buildQueueTracks, playbackRate, repeat, autoAdvanceSurah]
  );

  // Rebuild queue whenever the selection, qari, or auto-advance setting changes
  useEffect(() => {
    buildAndSetQueue(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahNumber, ayatRange, qariKey, autoAdvanceSurah]);

  // Repeat counts change the queue but not what is selected, so stay on the
  // ayat that is current instead of jumping back to the start.
  const isFirstRepeatRun = useRef(true);
  useEffect(() => {
    if (isFirstRepeatRun.current) {
      isFirstRepeatRun.current = false;
      return;
    }
    buildAndSetQueue(0, activeTrackUrlRef.current || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat.each, repeat.whole]);

  const buildAndSetQueueRef = useRef(buildAndSetQueue);
  useEffect(() => {
    buildAndSetQueueRef.current = buildAndSetQueue;
  }, [buildAndSetQueue]);

  // A queued local path dies with its file, but a new download can wait for
  // the next rebuild rather than interrupting playback.
  useEffect(() => {
    return subscribeToDownloadChanges((change) => {
      if (change === "added" && isPlayingRef.current) return;
      const index = queueEntriesRef.current.findIndex(
        ({ track }) => track.trackUrl === activeTrackUrlRef.current
      );
      buildAndSetQueueRef.current(Math.max(index, 0));
    });
  }, []);

  useEffect(() => {
    const handles = [
      NativeQuranAudio.addListener("trackChanged", ({ trackId }) => {
        const trackUrl = baseTrackUrl(trackId) as TrackUrl;
        activeTrackUrlRef.current = trackUrl;
        setActiveTrackUrl(trackUrl);
        scrollTrackIntoView(trackUrl);
      }),
      NativeQuranAudio.addListener("playbackState", ({ isPlaying: playing }) => {
        isPlayingRef.current = playing;
        setIsPlaying(playing);
      }),
      NativeQuranAudio.addListener("queueEnded", () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }),
      NativeQuranAudio.addListener("playbackError", ({ message }) => {
        console.error("Native playback error:", message);
        setBuildError(QUEUE_ERROR_MESSAGE);
      }),
    ];

    return () => {
      handles.forEach((handle) => handle.then((h) => h.remove()));
    };
  }, []);

  useEffect(() => {
    NativeQuranAudio.setRepeat({ enabled: repeat.whole === REPEAT_FOREVER && !autoAdvanceSurah }).catch(console.error);
  }, [repeat.whole, autoAdvanceSurah]);

  useEffect(() => {
    NativeQuranAudio.setPlaybackRate({ rate: playbackRate }).catch(console.error);
  }, [playbackRate]);

  const startPlayback = useCallback(() => {
    NativeQuranAudio.play().catch(console.error);
  }, []);

  const pauseAyat = useCallback(() => {
    NativeQuranAudio.pause().catch(console.error);
  }, []);

  const seekToTrack = useCallback(
    (trackUrl: TrackUrl) => {
      const index = queueEntriesRef.current.findIndex(({ track }) => track.trackUrl === trackUrl);
      if (index === -1) return;
      NativeQuranAudio.seek({ index }).then(startPlayback).catch(console.error);
    },
    [startPlayback]
  );

  const handlePlay = useCallback(
    ({ activeTrackUrl: trackUrl }: { activeTrackUrl: TrackUrl }) => {
      if (!trackUrl) {
        startPlayback();
        return;
      }
      seekToTrack(trackUrl);
    },
    [seekToTrack, startPlayback]
  );

  const handlePause = useCallback(() => pauseAyat(), [pauseAyat]);

  const handleReset = useCallback(() => {
    const first = queueEntriesRef.current[0];
    if (!first) return;
    NativeQuranAudio.seek({ index: 0 }).then(startPlayback).catch(console.error);
  }, [startPlayback]);

  const handleAyatClick = useCallback((trackUrl: TrackUrl) => seekToTrack(trackUrl), [seekToTrack]);

  const onIncreasePlaybackRate = useCallback(() => {
    setPlaybackRate((rate) => clampPlaybackRate(rate + PLAYBACK_RATE_STEP));
  }, [setPlaybackRate]);

  const onDecreasePlaybackRate = useCallback(() => {
    setPlaybackRate((rate) => clampPlaybackRate(rate - PLAYBACK_RATE_STEP));
  }, [setPlaybackRate]);

  const canIncreasePlaybackRate = playbackRate < MAX_PLAYBACK_RATE;
  const canDecreasePlaybackRate = playbackRate > MIN_PLAYBACK_RATE;

  const loadSelection = useCallback(
    ({
      surahNumber: nextSurahNumber,
      ayatRange: nextAyatRange,
    }: {
      surahNumber: number;
      ayatRange: SelectionRange;
      autoPlay?: boolean;
    }) => {
      setSurahNumber(nextSurahNumber);
      setAyatRange(nextAyatRange);
    },
    [setAyatRange, setSurahNumber]
  );

  const addCurrentSelectionToBookmarks = useCallback(() => {
    const newBookmark: Bookmark = {
      id: createId(),
      label: getSelectionLabel(surahNumber, ayatRange),
      surahNumber,
      ayatRange,
      createdAt: Date.now(),
    };
    setBookmarks((current) => {
      const exists = current.some(
        (b) =>
          b.surahNumber === surahNumber &&
          b.ayatRange[0] === ayatRange[0] &&
          b.ayatRange[1] === ayatRange[1]
      );
      return exists ? current : [newBookmark, ...current];
    });
  }, [surahNumber, ayatRange, setBookmarks]);

  const removeBookmark = useCallback(
    (bookmarkId: string) => {
      setBookmarks((current) => current.filter((b) => b.id !== bookmarkId));
    },
    [setBookmarks]
  );

  const reorderBookmarks = useCallback(
    (sourceBookmarkId: string, targetBookmarkId: string) => {
      if (sourceBookmarkId === targetBookmarkId) return;
      setBookmarks((current) => {
        const sourceIndex = current.findIndex((b) => b.id === sourceBookmarkId);
        const targetIndex = current.findIndex((b) => b.id === targetBookmarkId);
        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return current;
        const next = [...current];
        const [moved] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    },
    [setBookmarks]
  );

  const retryAudioBuild = useCallback(() => {
    buildAndSetQueue(0);
  }, [buildAndSetQueue]);

  useEffect(() => {
    document.title = `${title} - ${appName}`;
  }, [title]);

  return {
    isPlaying,
    activeTrackUrl,
    activeAyatNumber,
    qariKey,
    setQariKey,
    surah: selectedSurah,
    surahNumber,
    setSurahNumber,
    ayatRange,
    setAyatRange,
    loadSelection,
    bookmarks,
    addCurrentSelectionToBookmarks,
    removeBookmark,
    reorderBookmarks,
    repeat,
    setEach,
    setWhole,
    autoAdvanceSurah,
    setAutoAdvanceSurah,
    playbackRate,
    onIncreasePlaybackRate,
    onDecreasePlaybackRate,
    canIncreasePlaybackRate,
    canDecreasePlaybackRate,
    tracksToPlay,
    audioPlayerRef: nullAudioRef,
    preloadProgress,
    isReady,
    buildError,
    handlePlay,
    handlePause,
    handleReset,
    handleAyatClick,
    retryAudioBuild,
  };
};

export default useNativeQuranPlayer;
