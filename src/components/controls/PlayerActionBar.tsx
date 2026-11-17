import { type TrackUrl } from "../../_main/types";
import { describeProgress, type RepeatSettings } from "../hooks/quranPlayer/repeatSettings";
import type { RepeatCounters } from "../hooks/quranPlayer/useAudioElementEvents";
import { PauseIcon, PlayIcon, RestartIcon } from "../icons/ControlIcons";
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
  repeatCounters: RepeatCounters;
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
  repeatCounters,
  onOpenRepeat,
}: PlayerActionBarProps) => {
  const showRestart = activeAyatNumber > startingAyatNumber || repeatCounters.rangePass > 1;

  return (
    <div className="border-t border-slate-200 bg-white px-2 pt-1.5 pb-2">
      {activeAyatNumber > 0 && (
        <div className="px-1 pb-1.5 text-xs tabular-nums text-slate-500" aria-live="polite">
          {describeProgress(activeAyatNumber, repeat, repeatCounters)}
        </div>
      )}
      <div className="player-actions flex items-center gap-2">
        <PlaybackSpeedControl
          playbackRate={playbackRate}
          onIncrease={onIncreasePlaybackRate}
          onDecrease={onDecreasePlaybackRate}
          canIncrease={canIncreasePlaybackRate}
          canDecrease={canDecreasePlaybackRate}
        />
        <div className="player-play inline-flex min-w-0 flex-1 gap-1" role="group">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-base font-semibold text-white hover:bg-indigo-700"
            onClick={() => (isPlaying ? handlePause() : handlePlay({ activeTrackUrl }))}
          >
            {isPlaying ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          {showRestart && (
            <button
              type="button"
              aria-label={`Restart from ayah ${startingAyatNumber}`}
              title={`Restart from ayah ${startingAyatNumber}`}
              className="grid min-h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-primary"
              onClick={handleReset}
            >
              <RestartIcon width={18} height={18} />
            </button>
          )}
        </div>
        <RepeatPill repeat={repeat} onClick={onOpenRepeat} />
      </div>
    </div>
  );
};

export default PlayerActionBar;
