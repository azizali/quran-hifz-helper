import { type TrackUrl } from "../../_main/types";
import PlaybackSpeedControl from "./PlaybackSpeedControl";

type PlayerActionBarProps = {
  isPlaying: boolean;
  activeTrackUrl: TrackUrl;
  activeAyatNumber: number;
  startingAyatNumber: number;
  playbackRate: number;
  onIncreasePlaybackRate: () => void;
  onDecreasePlaybackRate: () => void;
  canIncreasePlaybackRate: boolean;
  canDecreasePlaybackRate: boolean;
  handlePlay: (args: { activeTrackUrl: TrackUrl }) => void;
  handlePause: () => void;
  handleReset: () => void;
};

const PlayerActionBar = ({
  isPlaying,
  activeTrackUrl,
  activeAyatNumber,
  startingAyatNumber,
  playbackRate,
  onIncreasePlaybackRate,
  onDecreasePlaybackRate,
  canIncreasePlaybackRate,
  canDecreasePlaybackRate,
  handlePlay,
  handlePause,
  handleReset,
}: PlayerActionBarProps) => {
  return (
    <div className="flex items-center gap-2 p-2 border-t border-slate-200 bg-white">
      <PlaybackSpeedControl
        playbackRate={playbackRate}
        onIncrease={onIncreasePlaybackRate}
        onDecrease={onDecreasePlaybackRate}
        canIncrease={canIncreasePlaybackRate}
        canDecrease={canDecreasePlaybackRate}
      />
      <div className="inline-flex shadow-sm flex-1" role="group">
        {!isPlaying && (
          <button
            className="btn bg-primary font-bold text-xl text-white w-full p-3"
            onClick={() => handlePlay({ activeTrackUrl })}
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

export default PlayerActionBar;

