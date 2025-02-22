import type { RefObject, SyntheticEvent } from "react";
import type { Track, TrackObject } from "../_main/types";
import PlayIcon from "./icons/PlayIcon";
import SaveIcon from "./icons/SaveIcon";
import { useCachedAssets } from "./useCachedAssets";

export const REPEAT_SOUND_TRACK = "REPEAT_SOUND_TRACK" as Track;

interface AyatListProps {
  tracksToPlay: TrackObject[];
  activeTrack: Track;
  activeAyatNumber: number;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  handleAyatClick: (track: Track) => void;
  isPlaying: boolean;
  audioPlayerRef: React.MutableRefObject<{
    [key: Track]: RefObject<HTMLAudioElement>;
  }>;
  handleEnded: (e: SyntheticEvent) => void;
}

export const AyatList: React.FC<AyatListProps> = ({
  tracksToPlay,
  activeTrack,
  activeAyatNumber,
  setIsPlaying,
  handleAyatClick,
  isPlaying,
  audioPlayerRef,
  handleEnded,
}) => {
  const cachedAudio = useCachedAssets("audio-cache", [
    activeAyatNumber,
    isPlaying,
  ]);

  return (
    <div className="overflow-y-scroll border scroll-smooth">
      {tracksToPlay.map(({ ayatNumber, track, trackUrl }) => {
        const isCachedTrack = cachedAudio[trackUrl];
        const isActiveTrack =
          activeTrack === track && track !== REPEAT_SOUND_TRACK;
        const isInactiveTrack =
          activeTrack !== track && track !== REPEAT_SOUND_TRACK;
        return (
          <div
            key={track}
            className="block p-2 border-y border-t-0 w-full even:bg-slate-100 last:hidden"
          >
            <div className="flex">
              {isActiveTrack && (
                <div className="w-full flex items-center gap-2">
                  Current Ayat #{activeAyatNumber}
                </div>
              )}
              {isInactiveTrack && (
                <button
                  className="w-full flex items-center gap-2"
                  onClick={() => handleAyatClick(track)}
                >
                  <PlayIcon />
                  Play Ayat #{ayatNumber}
                </button>
              )}
              {isCachedTrack && <SaveIcon />}
            </div>
            <audio
              key={track}
              id={track}
              ref={audioPlayerRef.current[track]}
              preload="true"
              controls={isActiveTrack}
              onEnded={handleEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              <source src={trackUrl} />
              <track
                src={trackUrl}
                kind="captions"
                srcLang="en"
                label="English"
              />
            </audio>
          </div>
        );
      })}
    </div>
  );
};

export default AyatList;
