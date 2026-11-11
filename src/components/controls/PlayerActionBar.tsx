import { type TrackUrl } from "../../_main/types";
import type { RepeatSettings } from "../hooks/quranPlayer/repeatSettings";
import PlaybackSpeedControl from "./PlaybackSpeedControl";
import { RepeatPill } from "./RepeatControl";

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
  repeat: RepeatSettings;
  onOpenRepeat: () => void;
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
  repeat,
  onOpenRepeat,
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
      <div className="inline-flex min-w-0 flex-1 gap-1" role="group">
        {!isPlaying && (
          <button
            className="btn min-w-0 flex-1 rounded-lg bg-primary p-2.5 text-lg font-bold text-white"
            onClick={() => handlePlay({ activeTrackUrl })}
          >
            Play
          </button>
        )}
        {isPlaying && (
          <button
            className="btn min-w-0 flex-1 rounded-lg bg-primary p-2.5 text-lg font-bold text-white"
            onClick={handlePause}
          >
            Pause
          </button>
        )}
        {activeAyatNumber > startingAyatNumber && (
          <button
            className="btn rounded-lg bg-secondary p-2.5 text-sm font-bold text-white"
            onClick={handleReset}
          >
            Restart
          </button>
        )}
      </div>
      <RepeatPill repeat={repeat} onClick={onOpenRepeat} />
    </div>
  );
};

export default PlayerActionBar;

