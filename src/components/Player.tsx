import { appName } from "../_main/config";
import AyatList from "./controls/AyatList";
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
    shouldRepeat,
    setShouldRepeat,
    tracksToPlay,
    audioPlayerRef,
    preloadProgress,
    buildError,
    retryAudioBuild,
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
        handlePlay={handlePlay}
        handlePause={handlePause}
        handleReset={handleReset}
      />
    </div>
  );
};

export default QuranApp;
