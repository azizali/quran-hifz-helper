import {
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { surahs } from "~/components/config";

const QuranApp = () => {
  const audioPlayerRef = useRef<any>({});
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTrack, setActiveTrack] = useState<string>("");

  const [surahNumber, setSurahNumber] = useState<number>(1);
  const [startingAyatNumber, setStartingAyatNumber] = useState<number>(1);
  const [endingAyatNumber, setEndingAyatNumber] = useState<number>(1);
  const [shouldRepeat, setShouldRepeat] = useState<boolean>(true);

  const surah = useMemo(() => {
    return surahs[surahNumber - 1];
  }, [surahNumber]);

  const ayatRangeToPlay = useMemo(() => {
    let ayatNumber = startingAyatNumber - 1;

    return Array.from({
      length: endingAyatNumber - ayatNumber,
    }).map(() => {
      ayatNumber++;

      const track: string = `${surahNumber
        .toString()
        .padStart(3, "0")}${ayatNumber.toString().padStart(3, "0")}`;
      audioPlayerRef.current[track] = createRef();

      return {
        surahNumber,
        ayatNumber,
        track,
      };
    });
  }, [surahNumber, startingAyatNumber, endingAyatNumber]);

  const currentAyat = useMemo(() => {
    return parseInt(activeTrack.split("").slice(3).join(""));
  }, [activeTrack]);

  const handleEnded = (e) => {
    const currentTrack = e.target.id;
    const trackIndex = ayatRangeToPlay.findIndex(
      ({ track }) => track === currentTrack
    );
    const nextTrack = ayatRangeToPlay[trackIndex + 1]?.track;

    if (nextTrack) {
      audioPlayerRef.current[nextTrack].current.play();
      setActiveTrack(nextTrack);
      return;
    }
    if (shouldRepeat) {
      const firstTrack = ayatRangeToPlay[0].track;
      audioPlayerRef.current[firstTrack].current.play();
      setActiveTrack(firstTrack);
      return;
    }
    setIsPlaying(false);
  };

  const handlePlay = (e) => {
    e.preventDefault();
    setIsPlaying(true);
    audioPlayerRef.current[activeTrack].current.play();
  };

  const handlePause = (e) => {
    e.preventDefault();
    setIsPlaying(false);
    audioPlayerRef.current[activeTrack].current.pause();
  };

  const handleStopAll = useCallback(() => {
    setIsPlaying(false);
    const tracks = Object.keys(audioPlayerRef.current);
    tracks.forEach((track) => {
      const elm = audioPlayerRef.current[track]?.current;
      if (!elm) return;
      elm.pause();
      elm.currentTime = 0;
    });
  }, []);

  useEffect(() => {
    setStartingAyatNumber(1);
    setEndingAyatNumber(surah.numberOfAyats);
  }, [surah]);

  useEffect(() => {
    if (!ayatRangeToPlay.length) return;
    handleStopAll();
    setActiveTrack(ayatRangeToPlay[0].track);
  }, [ayatRangeToPlay, handleStopAll]);

  useEffect(() => {
    document.title = `${surah.number}:${currentAyat} : ${surah.name} - Quran Hifz Helper`;
  }, [currentAyat, surah]);

  return (
    <div className="flex rounded-lg border-2 mx-auto p-9 w-full max-w-md flex-col justify-center gap-3 bg-white">
      <div style={{ display: "flex", justifyContent: "center" }}>
        <h1 style={{ fontSize: "1.5em", margin: 0, padding: 0 }}>
          Quran Hifz Helper
        </h1>
      </div>
      <div>
        {/* <div
          style={{ width: "100%", overflowY: "scroll" }}
          id="surah"
          value={surahNumber}
          size={1}
          onChange={(e) => {
            setSurahNumber(parseInt(e.target.value));
          }}
        >
          {surahs.map(({ number, name, nameEnglish }) => (
            <div key={name} value={number}>
              {number}. {name}: {nameEnglish}
            </div>
          ))}
        </div> */}
        <select
          className="border-2 rounded p-2 w-full"
          name="surah"
          id="surah"
          value={surahNumber}
          size={1}
          onChange={(e) => {
            setSurahNumber(parseInt(e.target.value));
          }}
        >
          {surahs.map(({ number, name, nameEnglish }) => (
            <option key={name} value={number}>
              {number}. {name}: {nameEnglish}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-between">
        <div className="flex gap-2 items-center">
          <label htmlFor="startAyat">Starting</label>
          <select
            className="border-2 rounded p-2"
            name="startingAyatNumber"
            id="startingAyatNumber"
            value={startingAyatNumber}
            onChange={(e) => {
              setStartingAyatNumber(parseInt(e.target.value));
            }}
          >
            {Array.from({ length: surah.numberOfAyats }).map((_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <label htmlFor="startAyat">Ending Ayat</label>
          <select
            className="border-2 rounded p-2"
            name="endingAyatNumber"
            id="endingAyatNumber"
            value={endingAyatNumber}
            onChange={(e) => {
              setEndingAyatNumber(parseInt(e.target.value));
            }}
          >
            {Array.from({
              length: surah.numberOfAyats - startingAyatNumber + 1,
            }).map((_, index) => {
              const ayatNumber = startingAyatNumber + index;
              return (
                <option key={ayatNumber} value={ayatNumber}>
                  {ayatNumber}
                </option>
              );
            })}
          </select>
        </div>
      </div>
      <div>
        {ayatRangeToPlay.map(({ track }) => {
          return (
            <audio
              key={track}
              id={track}
              ref={audioPlayerRef.current[track]}
              preload="true"
              // controls
              controls={activeTrack === track}
              onEnded={handleEnded}
              onPlay={handlePlay}
              onPause={handlePause}
              src={`https://mirrors.quranicaudio.com/muqri/alafasi/opus/${track}.opus`}
            ></audio>
          );
        })}
      </div>
      <div>
        <label htmlFor="shouldRepeat">Repeat</label>
        <input
          type="checkbox"
          name="shouldRepeat"
          id="shouldRepeat"
          checked={shouldRepeat}
          onChange={() => setShouldRepeat(!shouldRepeat)}
        />
      </div>
      Current Ayat: {currentAyat}
      <div>
        {!isPlaying && (
          <button
            className="rounded bg-indigo-600 px-2 py-1 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            style={{ width: "100%" }}
            onClick={handlePlay}
          >
            Play
          </button>
        )}
        {isPlaying && (
          <button
            className="rounded bg-indigo-600 px-2 py-1 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            style={{ width: "100%" }}
            onClick={handlePause}
          >
            Pause
          </button>
        )}
      </div>
    </div>
  );
};

export default QuranApp;
