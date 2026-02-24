import type { TrackObject, TrackUrl } from "../../_main/types";
import PlayIcon from "../icons/PlayIcon";
import SaveIcon from "../icons/SaveIcon";
import { useCachedAssets } from "../useCachedAssets";

export const REPEAT_SOUND_TRACK = "/click-sound.mp3" as TrackUrl;

interface AyatListProps {
  tracksToPlay: TrackObject[];
  activeTrackUrl: TrackUrl;
  activeAyatNumber: number;
  handleAyatClick: (track: TrackUrl) => void;
  isPlaying: boolean;
}

export const AyatList: React.FC<AyatListProps> = ({
  tracksToPlay,
  activeTrackUrl,
  activeAyatNumber,
  handleAyatClick,
  isPlaying,
}) => {
  const cachedAudio = useCachedAssets("audio-cache", [
    activeTrackUrl,
    isPlaying,
  ]);

  return (
    <div className="overflow-y-scroll border scroll-smooth">
      {tracksToPlay.map(({ ayatNumber, trackUrl }) => {
        const isCachedTrack = cachedAudio[trackUrl];
        const isActiveTrack =
          activeTrackUrl === trackUrl && trackUrl !== REPEAT_SOUND_TRACK;
        const isInactiveTrack =
          activeTrackUrl !== trackUrl && trackUrl !== REPEAT_SOUND_TRACK;
        return (
          <div
            key={trackUrl}
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
                  onClick={() => handleAyatClick(trackUrl)}
                >
                  <PlayIcon />
                  Play Ayat #{ayatNumber}
                </button>
              )}
              {isCachedTrack && <SaveIcon />}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AyatList;
