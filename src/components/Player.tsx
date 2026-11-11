import { App } from "@capacitor/app";
import { useEffect, useState } from "react";
import { appName } from "../_main/config";
import { isNativePlatform } from "../_main/platform";
import { useLocalStorage } from "usehooks-ts";
import AyatList from "./controls/AyatList";
import { ListToggleButtons, MemorizationSummary } from "./controls/AyatListToolbar";
import OfflineStatus from "./controls/OfflineStatus";
import LibraryPanel from "./controls/LibraryPanel";
import NativeProgressBar from "./controls/NativeProgressBar";
import PlayControls from "./controls/PlayControls";
import PlayerActionBar from "./controls/PlayerActionBar";
import PreloadProgress from "./controls/PreloadProgress";
import { RepeatSheet } from "./controls/RepeatControl";
import Header from "./Header";
import useQuranPlayer from "./hooks/useQuranPlayer";
import { useMemorization } from "./hooks/useMemorization";

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

  const [hideText, setHideText] = useLocalStorage<boolean>("hideText", false);
  const [trackMemorization, setTrackMemorization] = useLocalStorage<boolean>("trackMemorization", false);
  const { statuses, cycle: cycleStatus, counts: memorizationCounts } = useMemorization(
    surahNumber,
    surah.numberOfAyats
  );

  const startingAyatNumber = tracksToPlay[0]?.ayatNumber ?? ayatRange[0];
  
  const findCurrentBookmark = () =>
    bookmarks.find(
      (b) =>
        b.surahNumber === surahNumber &&
        b.ayatRange[0] === ayatRange[0] &&
        b.ayatRange[1] === ayatRange[1]
    );

  const currentBookmark = findCurrentBookmark();
  const isBookmarked = Boolean(currentBookmark);
  
  const toggleCurrentSelectionBookmark = () => {
    if (currentBookmark) {
      removeBookmark(currentBookmark.id);
    } else {
      addCurrentSelectionToBookmarks();
    }
  };
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);

  // Android back: close the panel, otherwise background the app so a
  // relaunch doesn't restart the JS layer and stop playback.
  useEffect(() => {
    if (!isNativePlatform()) return;
    const handle = App.addListener("backButton", () => {
      if (showDownloads) {
        setShowDownloads(false);
      } else if (showRepeat) {
        setShowRepeat(false);
      } else if (showBookmarks) {
        setShowBookmarks(false);
      } else {
        App.minimizeApp();
      }
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }, [showBookmarks, showRepeat, showDownloads]);

  return (
    <div className="app-shell flex mx-auto w-full max-w-md md:max-w-4xl xl:max-w-6xl flex-col bg-white md:shadow-sm">
      <Header
        appName={appName}
        rightActions={(
          <button
            onClick={() => setShowBookmarks((v) => !v)}
            className="header-action-btn"
            aria-label="Bookmarks"
          >
            Bookmarks
          </button>
        )}
      />
      <div className="p-4 flex-grow min-h-0 overflow-hidden flex gap-2 flex-col md:flex-row md:gap-6">
        <div className="flex flex-col gap-2 md:w-72 md:shrink-0 md:overflow-y-auto">
          <PlayControls
            qariKey={qariKey}
            setQariKey={setQariKey}
            ayatRange={ayatRange}
            setAyatRange={setAyatRange}
            surah={surah}
            surahNumber={surahNumber}
            setSurahNumber={setSurahNumber}
            toggleCurrentSelectionBookmark={toggleCurrentSelectionBookmark}
            isBookmarked={isBookmarked}
            rangeActions={
              <ListToggleButtons
                hideText={hideText}
                onToggleHideText={() => setHideText((v) => !v)}
                trackMemorization={trackMemorization}
                onToggleTracking={() => setTrackMemorization((v) => !v)}
              />
            }
            offlineStatus={
              <OfflineStatus
                surah={surah}
                qariKey={qariKey}
                ayatRange={ayatRange}
                open={showDownloads}
                onOpenChange={setShowDownloads}
              />
            }
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {trackMemorization && (
            <MemorizationSummary
              numberOfAyats={surah.numberOfAyats}
              statuses={statuses}
              counts={memorizationCounts}
            />
          )}
          <AyatList
            hideText={hideText}
            trackMemorization={trackMemorization}
            statuses={statuses}
            onCycleStatus={cycleStatus}
            tracksToPlay={tracksToPlay}
            activeTrackUrl={activeTrackUrl}
            activeAyatNumber={activeAyatNumber}
            handleAyatClick={handleAyatClick}
            isPlaying={isPlaying}
          />
        </div>
        {showBookmarks && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black bg-opacity-30 transition-opacity" onClick={() => setShowBookmarks(false)} />
            <div className="safe-area-y relative ml-auto w-full max-w-md h-full bg-white shadow-lg animate-slide-in-right">
              <LibraryPanel
                bookmarks={bookmarks}
                loadSelection={(args) => {
                  loadSelection(args);
                  setShowBookmarks(false);
                }}
                removeBookmark={removeBookmark}
                reorderBookmarks={reorderBookmarks}
                onClose={() => setShowBookmarks(false)}
              />
            </div>
          </div>
        )}
      </div>
      <PreloadProgress
        loaded={preloadProgress.loaded}
        total={preloadProgress.total}
      />

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
        onOpenRepeat={() => setShowRepeat(true)}
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
