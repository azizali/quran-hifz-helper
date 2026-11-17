import { App } from "@capacitor/app";
import { useEffect, useRef, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { isNativePlatform } from "../_main/platform";
import AyatList from "./controls/AyatList";
import ControlsRail from "./controls/ControlsRail";
import { describeProgress, describeRepeat } from "./hooks/quranPlayer/repeatSettings";
import { ChevronLeftIcon, TextStyleIcon } from "./icons/ControlIcons";
import TextSettingsSheet from "./controls/TextSettingsSheet";
import { textVariantFor, type QuranScript } from "./quranText";
import { scrollTrackIntoView } from "./utils";
import LeaveRangeSheet from "./controls/LeaveRangeSheet";
import LibraryPanel from "./controls/LibraryPanel";
import NativeProgressBar from "./controls/NativeProgressBar";
import OfflineStatus from "./controls/OfflineStatus";
import PlayerActionBar from "./controls/PlayerActionBar";
import PreloadProgress from "./controls/PreloadProgress";
import QariSelector from "./controls/QariSelector";
import RangeBar, { type PlayerMode } from "./controls/RangeBar";
import { RepeatSheet } from "./controls/RepeatControl";
import SurahSelector from "./controls/SurahSelector";
import useQuranPlayer from "./hooks/useQuranPlayer";
import { useMemorization } from "./hooks/useMemorization";
import BookmarkIcon from "./icons/BookmarkIcon";

/**
 * Layout, top to bottom, in the order it is used:
 * 1. Qari, then surah with the offline and saved-range buttons.
 * 2. The range: From and To, Save, and Listen / Memorize.
 * 3. The ayat. Only this list scrolls.
 * 4. Playback, always in reach.
 */
const QuranApp = () => {
  const {
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
    loadSelection,
    bookmarks,
    addCurrentSelectionToBookmarks,
    removeBookmark,
    reorderBookmarks,
    repeat,
    repeatCounters,
    setEach,
    setWhole,
    tracksToPlay,
    audioPlayerRef,
    preloadProgress,
    buildError,
    retryAudioBuild,
    playbackRate,
    onIncreasePlaybackRate,
    onDecreasePlaybackRate,
    canIncreasePlaybackRate,
    canDecreasePlaybackRate,
    handlePlay,
    handlePause,
    handleReset,
    handleAyatClick,
  } = useQuranPlayer();

  const [mode, setMode] = useLocalStorage<PlayerMode>("playerMode", "listen");
  // Landscape only: the controls drawer can slide away, leaving an icon rail.
  const [controlsHidden, setControlsHidden] = useLocalStorage<boolean>("controlsHidden", false);
  const [quranScript, setQuranScript] = useLocalStorage<QuranScript>("quranScript", "naskh");
  const [tajweed, setTajweed] = useLocalStorage<boolean>("tajweedColours", false);
  const [showTextSettings, setShowTextSettings] = useState(false);

  // Hiding or showing the drawer changes the list's width, so the text reflows and
  // the scroll offset no longer matches. Bring the current ayah back once the slide ends.
  const activeTrackUrlRef = useRef(activeTrackUrl);
  activeTrackUrlRef.current = activeTrackUrl;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeTrackUrlRef.current) scrollTrackIntoView(activeTrackUrlRef.current);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [controlsHidden]);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const { statuses, cycle: cycleStatus, counts: memorizationCounts } = useMemorization(
    surahNumber,
    surah.numberOfAyats
  );

  // A new surah or mode hides everything again and drops a half-picked range.
  useEffect(() => {
    setRevealed({});
    setPendingStart(null);
  }, [surahNumber, mode]);

  const startingAyatNumber = tracksToPlay[0]?.ayatNumber ?? ayatRange[0];

  const currentBookmark = bookmarks.find(
    (b) =>
      b.surahNumber === surahNumber &&
      b.ayatRange[0] === ayatRange[0] &&
      b.ayatRange[1] === ayatRange[1]
  );
  const isBookmarked = Boolean(currentBookmark);

  const toggleCurrentSelectionBookmark = () => {
    if (currentBookmark) {
      removeBookmark(currentBookmark.id);
    } else {
      addCurrentSelectionToBookmarks();
    }
  };

  const changeRange = (range: [number, number]) => {
    setPendingStart(null);
    setAyatRange(range);
  };

  // First tap marks the start; the second sets the range. Nothing is rebuilt until then.
  const pickNumber = (ayatNumber: number) => {
    if (pendingStart === null) {
      setPendingStart(ayatNumber);
      return;
    }
    changeRange([Math.min(pendingStart, ayatNumber), Math.max(pendingStart, ayatNumber)]);
  };

  const anyRevealed = Object.keys(revealed).length > 0;
  const toggleRevealAll = () => {
    if (anyRevealed) {
      setRevealed({});
      return;
    }
    const all: Record<number, boolean> = {};
    for (let n = 1; n <= surah.numberOfAyats; n++) all[n] = true;
    setRevealed(all);
  };

  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  // An ayah tapped outside the range, waiting for the user to confirm leaving the range.
  const [leaveRangeFor, setLeaveRangeFor] = useState<number | null>(null);

  // Confirmed: the range becomes this ayah to the end of the surah, and it plays.
  const playFromOutsideRange = (ayatNumber: number) => {
    setLeaveRangeFor(null);
    setPendingStart(null);
    loadSelection({ surahNumber, ayatRange: [ayatNumber, surah.numberOfAyats], autoPlay: true });
  };

  // Android back: close the panel or cancel a half-picked range, otherwise
  // background the app so a relaunch doesn't restart the JS layer and stop playback.
  useEffect(() => {
    if (!isNativePlatform()) return;
    const handle = App.addListener("backButton", () => {
      if (leaveRangeFor !== null) {
        setLeaveRangeFor(null);
      } else if (showTextSettings) {
        setShowTextSettings(false);
      } else if (showDownloads) {
        setShowDownloads(false);
      } else if (showRepeat) {
        setShowRepeat(false);
      } else if (showBookmarks) {
        setShowBookmarks(false);
      } else if (pendingStart !== null) {
        setPendingStart(null);
      } else {
        App.minimizeApp();
      }
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }, [showBookmarks, showRepeat, showDownloads, showTextSettings, pendingStart, leaveRangeFor]);

  return (
    <div
      className="app-shell player-shell mx-auto w-full max-w-md md:max-w-4xl xl:max-w-6xl bg-white md:shadow-sm"
      data-controls={controlsHidden ? "hidden" : "shown"}
    >
      <div className="player-controls shrink-0">
      <div className="shrink-0 border-b border-slate-200 px-3 pt-2 pb-1">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <QariSelector qariKey={qariKey} setQariKey={setQariKey} />
          </div>
          {/* Shown in landscape only (see .hide-controls-button in global.css). */}
          <button
            type="button"
            onClick={() => setControlsHidden(true)}
            aria-label="Hide controls"
            className="hide-controls-button min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-primary"
          >
            <ChevronLeftIcon />
            <span>Hide</span>
          </button>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <SurahSelector
            surahNumber={surahNumber}
            setSurahNumber={setSurahNumber}
            setAyatRange={setAyatRange}
          />
          <OfflineStatus
            surah={surah}
            qariKey={qariKey}
            ayatRange={ayatRange}
            open={showDownloads}
            onOpenChange={setShowDownloads}
          />
          <button
            type="button"
            onClick={() => setShowTextSettings(true)}
            aria-label="Quran text: script and tajweed colours"
            title="Quran text"
            className="grid min-h-11 w-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-primary"
          >
            <TextStyleIcon />
          </button>
          <button
            type="button"
            onClick={() => setShowBookmarks(true)}
            aria-label={`Saved ranges: ${bookmarks.length}`}
            className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium tabular-nums text-slate-500 hover:bg-slate-50"
          >
            <BookmarkIcon />
            <span>{bookmarks.length}</span>
          </button>
        </div>
      </div>

      <RangeBar
        ayatRange={ayatRange}
        numberOfAyats={surah.numberOfAyats}
        onRangeChange={changeRange}
        pendingStart={pendingStart}
        isBookmarked={isBookmarked}
        onToggleBookmark={toggleCurrentSelectionBookmark}
        mode={mode}
        onModeChange={setMode}
        memorization={
          mode === "memorize"
            ? { counts: memorizationCounts, anyRevealed, onToggleRevealAll: toggleRevealAll }
            : undefined
        }
      />
      </div>

      <AyatList
        surahNumber={surahNumber}
        numberOfAyats={surah.numberOfAyats}
        ayatRange={ayatRange}
        tracksToPlay={tracksToPlay}
        activeTrackUrl={activeTrackUrl}
        handleAyatClick={handleAyatClick}
        mode={mode}
        revealed={revealed}
        onToggleReveal={(n) => setRevealed((current) => ({ ...current, [n]: !current[n] }))}
        statuses={statuses}
        onCycleStatus={cycleStatus}
        pendingStart={pendingStart}
        onPickNumber={pickNumber}
        onCancelPick={() => setPendingStart(null)}
        script={quranScript}
        textVariant={textVariantFor(quranScript, tajweed)}
        onPlayOutsideRange={setLeaveRangeFor}
      />
      {controlsHidden && (
        <ControlsRail
          isPlaying={isPlaying}
          onPlay={() => handlePlay({ activeTrackUrl })}
          onPause={handlePause}
          onRestart={handleReset}
          onOpenRepeat={() => setShowRepeat(true)}
          onShowControls={() => setControlsHidden(false)}
          startingAyatNumber={startingAyatNumber}
          activeAyatNumber={activeAyatNumber}
          progressLabel={describeProgress(activeAyatNumber, repeat, repeatCounters)}
          repeatLabel={describeRepeat(repeat)}
        />
      )}
      <LeaveRangeSheet
        ayatNumber={leaveRangeFor}
        ayatRange={ayatRange}
        numberOfAyats={surah.numberOfAyats}
        onConfirm={playFromOutsideRange}
        onCancel={() => setLeaveRangeFor(null)}
      />

      {showBookmarks && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black bg-opacity-30 transition-opacity"
            onClick={() => setShowBookmarks(false)}
          />
          <div className="safe-area-y relative ml-auto w-full max-w-md h-full bg-white shadow-lg animate-slide-in-right">
            <LibraryPanel
              bookmarks={bookmarks}
              loadSelection={(args) => {
                loadSelection(args);
                setPendingStart(null);
                setShowBookmarks(false);
              }}
              removeBookmark={removeBookmark}
              reorderBookmarks={reorderBookmarks}
              onClose={() => setShowBookmarks(false)}
            />
          </div>
        </div>
      )}

      <div className="player-bottom shrink-0">
      <PreloadProgress loaded={preloadProgress.loaded} total={preloadProgress.total} />

      {buildError && (
        <div className="px-4 py-2 bg-red-50 border border-red-300 text-red-800 text-sm">
          <div className="mb-1">{buildError}</div>
          <button
            onClick={retryAudioBuild}
            className="text-red-600 underline hover:text-red-800 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {isNativePlatform() ? (
        <NativeProgressBar trackCount={tracksToPlay.length} />
      ) : (
        <audio
          ref={audioPlayerRef}
          className="w-full px-4 pb-2"
          controls
          playsInline
          webkit-playsinline="true"
          preload="auto"
        />
      )}

      <PlayerActionBar
        isPlaying={isPlaying}
        activeTrackUrl={activeTrackUrl}
        activeAyatNumber={activeAyatNumber}
        startingAyatNumber={startingAyatNumber}
        playbackRate={playbackRate}
        onIncreasePlaybackRate={onIncreasePlaybackRate}
        onDecreasePlaybackRate={onDecreasePlaybackRate}
        canIncreasePlaybackRate={canIncreasePlaybackRate}
        canDecreasePlaybackRate={canDecreasePlaybackRate}
        handlePlay={handlePlay}
        handlePause={handlePause}
        handleReset={handleReset}
        repeat={repeat}
        repeatCounters={repeatCounters}
        onOpenRepeat={() => setShowRepeat(true)}
      />
      </div>
      <TextSettingsSheet
        open={showTextSettings}
        onOpenChange={setShowTextSettings}
        script={quranScript}
        onScriptChange={setQuranScript}
        tajweed={tajweed}
        onTajweedChange={setTajweed}
      />
      <RepeatSheet
        repeat={repeat}
        setEach={setEach}
        setWhole={setWhole}
        open={showRepeat}
        onOpenChange={setShowRepeat}
      />
    </div>
  );
};

export default QuranApp;
