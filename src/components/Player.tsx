import { useStore } from "@nanostores/react";
import {
  type RefObject,
  type SyntheticEvent,
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocalStorage } from "usehooks-ts";
import { appName } from "../_main/config";
import reciters from "../_main/reciters";
import { activeTrack } from "../_main/sharedState";
import { surahs } from "../_main/surahs";
import { type Track, type TrackObject } from "../_main/types";
import {
  genTrackFromSurahAndAyat,
  parseSurahAyatFromTrack,
} from "../_main/utils";
import AyatList, { REPEAT_SOUND_TRACK } from "./AyatList";
import Header from "./Header";
import PlayControls from "./PlayControls";
const audioExtention = "mp3"; // 'opus' | 'mp3'
const audioSrcBaseUrl = `https://everyayah.com/data`;
// https://mirrors.quranicaudio.com/muqri/alafasi/opus

const QuranApp = () => {
  const [reciterUrlPath, setSelectedReciter] = useState(
    reciters["husary"].urlPath
  );
  const audioPlayerRef = useRef<{ [key: Track]: RefObject<HTMLAudioElement> }>(
    {}
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const $activeTrack = useStore(activeTrack);
  const [surahNumber, setSurahNumber] = useLocalStorage<number>(
    "surahNumber",
    1
  );
  const [startingAyatNumber, setStartingAyatNumber] = useLocalStorage<number>(
    "startingAyatNumber",
    1
  );
  const [endingAyatNumber, setEndingAyatNumber] = useLocalStorage<number>(
    "endingAyatNumber",
    1
  );
  const [shouldRepeat, setShouldRepeat] = useLocalStorage<boolean>(
    "shouldRepeat",
    true
  );

  const surah = useMemo(() => {
    return surahs[surahNumber - 1];
  }, [surahNumber]);

  const tracksToPlay = useMemo(() => {
    let ayatNumber = startingAyatNumber - 1;

    const trackObjects: TrackObject[] = Array.from({
      length: endingAyatNumber - ayatNumber,
    }).map(() => {
      ayatNumber++;

      const track: Track = genTrackFromSurahAndAyat({
        surahNumber,
        ayatNumber,
      });

      audioPlayerRef.current[track] = createRef();

      return {
        surahNumber,
        ayatNumber,
        track,
        trackUrl: `${audioSrcBaseUrl}/${reciterUrlPath}/${track}.${audioExtention}`,
      };
    });

    if (shouldRepeat) {
      trackObjects.push({
        surahNumber,
        ayatNumber,
        track: REPEAT_SOUND_TRACK as Track,
        trackUrl: "/click-sound.mp3",
      });
      audioPlayerRef.current[REPEAT_SOUND_TRACK] = createRef();
    }

    return trackObjects;
  }, [
    startingAyatNumber,
    endingAyatNumber,
    shouldRepeat,
    surahNumber,
    reciterUrlPath,
  ]);

  const activeAyatNumber = useMemo(() => {
    return parseSurahAyatFromTrack($activeTrack).ayat;
  }, [$activeTrack]);

  const playAyat = (ayatNumber: Track) => {
    const audioRef = audioPlayerRef.current[ayatNumber]
      .current as HTMLAudioElement;
    audioRef.play();
    setIsPlaying(true);

    const parentElement = audioRef.parentElement as Element;
    if (parentElement.previousElementSibling) {
      parentElement.previousElementSibling.scrollIntoView();
    } else {
      parentElement.scrollIntoView();
    }
  };

  const pauseAyat = (ayatNumber: Track) => {
    const audioRef = audioPlayerRef.current[ayatNumber]
      .current as HTMLAudioElement;
    audioRef.pause();
    setIsPlaying(false);
  };

  const handleEnded = (e: SyntheticEvent) => {
    const currentTrack = (e.target as HTMLElement).id;
    const trackIndex = tracksToPlay.findIndex(
      ({ track }) => track === currentTrack
    );
    const nextTrack = tracksToPlay[trackIndex + 1]?.track as Track;

    if (nextTrack) {
      activeTrack.set(nextTrack);
      playAyat(nextTrack);
      return;
    }
    if (shouldRepeat) {
      const firstTrack = tracksToPlay[0].track;
      activeTrack.set(firstTrack);
      playAyat(firstTrack);
      return;
    }
    setIsPlaying(false);
  };

  const handlePlay = useCallback(({ activeTrack }: { activeTrack: Track }) => {
    try {
      playAyat(activeTrack);
    } catch (e) {
      console.log(e);
    }
  }, []);

  const handlePause = () => pauseAyat($activeTrack);

  const handleReset = () => {
    handleStopAll();
    const firstTrack: Track = tracksToPlay[0].track;
    activeTrack.set(firstTrack);
    handlePlay({ activeTrack: firstTrack });
  };

  const handleStopAll = useCallback(() => {
    setIsPlaying(false);
    const tracks = Object.keys(audioPlayerRef.current) as Array<Track>;
    tracks.forEach((track) => {
      const elm = audioPlayerRef.current[track]?.current;
      if (!elm) return;
      elm.pause();
      elm.currentTime = 0;
    });
  }, []);

  const handleAyatClick = useCallback(
    (track: Track) => {
      handleStopAll();
      activeTrack.set(track);
      handlePlay({ activeTrack: track });
    },
    [handlePlay, handleStopAll]
  );

  useEffect(() => {
    if (!tracksToPlay.length) return;
    handleStopAll();
    activeTrack.set(tracksToPlay[0].track);
  }, [tracksToPlay, handleStopAll]);

  useEffect(() => {
    document.title = `${surah.id}:${activeAyatNumber} : ${surah.name} - ${appName}`;
  }, [activeAyatNumber, surah]);

  useEffect(() => {
    if (endingAyatNumber < startingAyatNumber)
      setEndingAyatNumber(startingAyatNumber);
  }, [startingAyatNumber, endingAyatNumber, setEndingAyatNumber]);

  return (
    <div className="flex h-screen mx-auto w-full max-w-md flex-col bg-white">
      <Header appName={appName} />
      <div className="p-4 flex-grow overflow-hidden flex gap-2 flex-col ">
        <PlayControls
          setSelectedReciterCb={setSelectedReciter}
          startingAyatNumber={startingAyatNumber}
          setStartingAyatNumber={setStartingAyatNumber}
          endingAyatNumber={endingAyatNumber}
          setEndingAyatNumber={setEndingAyatNumber}
          surah={surah}
          surahs={surahs}
          surahNumber={surahNumber}
          setSurahNumber={setSurahNumber}
        />
        <AyatList
          tracksToPlay={tracksToPlay}
          activeTrack={$activeTrack}
          activeAyatNumber={activeAyatNumber}
          setIsPlaying={setIsPlaying}
          handleAyatClick={handleAyatClick}
          isPlaying={isPlaying}
          audioPlayerRef={audioPlayerRef}
          handleEnded={handleEnded}
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
            onClick={() => handlePlay({ activeTrack: $activeTrack })}
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
