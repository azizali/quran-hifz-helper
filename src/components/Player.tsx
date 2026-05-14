import { useState } from "react";
import { appName } from "../_main/config";
import AyatList from "./controls/AyatList";
import LibraryPanel from "./controls/LibraryPanel";
import PlayControls from "./controls/PlayControls";
import PlayerActionBar from "./controls/PlayerActionBar";
import PreloadProgress from "./controls/PreloadProgress";
import RepeatControl from "./controls/RepeatControl";
import Header from "./Header";
import useQuranPlayer from "./hooks/useQuranPlayer";

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
    shouldRepeat,
    setShouldRepeat,
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

  return (
    <div className="flex h-screen mx-auto w-full max-w-md flex-col bg-white">
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
      <div className="px-4 pb-4 flex-grow overflow-hidden flex gap-2 flex-col">
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
        />
        <AyatList
          tracksToPlay={tracksToPlay}
          activeTrackUrl={activeTrackUrl}
          activeAyatNumber={activeAyatNumber}
          handleAyatClick={handleAyatClick}
          isPlaying={isPlaying}
        />
        <RepeatControl
          shouldRepeat={shouldRepeat}
          setShouldRepeat={setShouldRepeat}
          activeAyatNumber={activeAyatNumber}
        />
        {showBookmarks && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black bg-opacity-30 transition-opacity" onClick={() => setShowBookmarks(false)} />
            <div className="relative ml-auto w-full max-w-md h-full bg-white shadow-lg animate-slide-in-right">
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

      <audio
        ref={audioPlayerRef}
        className="w-full px-4 pb-2"
        controls
        playsInline
        webkit-playsinline="true"
        preload="auto"
      />

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
      />
    </div>
  );
};

export default QuranApp;
