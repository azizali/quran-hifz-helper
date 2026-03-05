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
    handlePlay,
    handlePause,
    handleReset,
    handleEnded,
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
      
      {/* Global Audio Element for proper seamless background playback */}
      <audio
        ref={audioPlayerRef}
        className="w-full px-4 pb-2"
        controls
        data-trackurl={activeTrackUrl}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        playsInline
        webkit-playsinline="true"
        preload="auto"
        crossOrigin="anonymous"
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
