import { appName } from "../_main/config";
import AyatList from "./controls/AyatList";
import PlayControls from "./controls/PlayControls";
import PlayerActionBar from "./controls/PlayerActionBar";
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
    shouldRepeat,
    setShouldRepeat,
    tracksToPlay,
    audioPlayerRef,
    preloadProgress,
    handlePlay,
    handlePause,
    handleReset,
    handleAyatClick,
  } = useQuranPlayer();

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
      </div>
      
      {/* Buffer progress — all tracks must be preloaded for reliable background playback */}
      {preloadProgress.total > 0 && preloadProgress.loaded < preloadProgress.total && (
        <div className="px-4 pb-1">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(preloadProgress.loaded / preloadProgress.total) * 100}%` }}
              />
            </div>
            <span>Buffering {preloadProgress.loaded}/{preloadProgress.total}</span>
          </div>
        </div>
      )}

      {/* Single persistent audio element — event listeners attached natively in hook */}
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
        handlePlay={handlePlay}
        handlePause={handlePause}
        handleReset={handleReset}
      />
    </div>
  );
};

export default QuranApp;
