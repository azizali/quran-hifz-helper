import type { TrackObject, TrackUrl } from "../../_main/types";
import PlayIcon from "../icons/PlayIcon";
import SaveIcon from "../icons/SaveIcon";
import { useCachedAssets } from "../useCachedAssets";

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
    <div className="overflow-y-scroll border scroll-smooth rounded">
      {tracksToPlay.map(({ ayatNumber, trackUrl, surahNumber }, index) => {
        const isCachedTrack = cachedAudio[trackUrl];
        const isActiveTrack = activeTrackUrl === trackUrl;
        const isInactiveTrack = !isActiveTrack;
        const trackLabel = `Surah ${surahNumber} - Ayat ${ayatNumber}`;
        
        return (
          <div
            key={`${trackUrl}-${index}`}
                data-track-url={trackUrl}
            className="block p-2 border-b last:border-b-0 w-full even:bg-slate-100"
          >
            <div className="flex">
              {isActiveTrack && (
                <div className="w-full flex items-center gap-2 font-bold text-primary">
                  Current {trackLabel} (Ayat #{activeAyatNumber})
                </div>
              )}
              {isInactiveTrack && (
                <button
                  className="w-full flex items-center gap-2"
                  onClick={() => handleAyatClick(trackUrl)}
                >
                  <PlayIcon />
                  Play {trackLabel}
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
