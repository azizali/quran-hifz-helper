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
import {
  activeTrack,
  ayatRange,
  selectedReciter,
  selectedSurah,
  shouldRepeat,
} from "../_main/sharedState";
import { type Track, type TrackObject } from "../_main/types";
import {
  genTrackFromSurahAndAyat,
  parseSurahAyatFromTrack,
} from "../_main/utils";
import AyatList, { REPEAT_SOUND_TRACK } from "./AyatList";
const audioExtention = "mp3"; // 'opus' | 'mp3'
const audioSrcBaseUrl = `https://everyayah.com/data`;

const QuranApp = () => {
  const $selectecReciter = useStore(selectedReciter);
  const audioPlayerRef = useRef<{ [key: Track]: RefObject<HTMLAudioElement> }>(
    {}
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const $activeTrack = useStore(activeTrack);
  const $selectedSurah = useStore(selectedSurah);
  const [startingAyatNumber, endingAyatNumber] = useStore(ayatRange);
  const $shouldRepeat = useStore(shouldRepeat);

  const tracksToPlay = useMemo(() => {
    let ayatNumber = startingAyatNumber - 1;

    const trackObjects: TrackObject[] = Array.from({
      length: endingAyatNumber - ayatNumber,
    }).map(() => {
      ayatNumber++;

      const track: Track = genTrackFromSurahAndAyat({
        surahNumber: $selectedSurah.id,
        ayatNumber,
      });

      audioPlayerRef.current[track] = createRef();

      return {
        surahNumber: $selectedSurah.id,
        ayatNumber,
        track,
        trackUrl: `${audioSrcBaseUrl}/${$selectecReciter.urlPath}/${track}.${audioExtention}`,
      };
    });

    if ($shouldRepeat) {
      trackObjects.push({
        surahNumber: $selectedSurah.id,
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
    $shouldRepeat,
    $selectedSurah,
    $selectecReciter,
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
    if ($shouldRepeat) {
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

  return (
    <div>
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
      <div className="w-full inline-flex" role="group">
        {!isPlaying && (
          <button
            className="btn bg-primary font-bold text-xl text-white w-full p-3"
            onClick={() => handlePlay({ activeTrack: $activeTrack })}
          >
            Play <span className="text-xs">(Current ayat #{activeAyatNumber})</span>
          </button>
        )}
        {isPlaying && (
          <button
            className="btn bg-primary font-bold text-xl text-white w-full p-3"
            onClick={handlePause}
          >
            Pause  <span className="text-xs">(Current ayat #{activeAyatNumber})</span>
          </button>
        )}
        {activeAyatNumber > startingAyatNumber && (
          <button
            className="btn bg-muted-foreground font-bold text-xl text-white p-3"
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
