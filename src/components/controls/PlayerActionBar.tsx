import { type TrackUrl } from "../../_main/types";
import { REPEAT_FOREVER, type RepeatSettings } from "../hooks/quranPlayer/repeatSettings";
import type { RepeatCounters } from "../hooks/quranPlayer/useAudioElementEvents";
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

/** "Ayah 214 · play 2 of 3 · pass 4 of 10". Repeat parts appear only when repeats are on. */
const describeProgress = (ayat: number, repeat: RepeatSettings, counters: RepeatCounters) => {
  const parts = [`Ayah ${ayat}`];
  if (repeat.each > 1) parts.push(`play ${counters.ayatPlay} of ${repeat.each}`);
  if (repeat.whole !== 1) {
    parts.push(`pass ${counters.rangePass} of ${repeat.whole === REPEAT_FOREVER ? "∞" : repeat.whole}`);
  }
  return parts.join(" · ");
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
      <div className="flex items-center gap-2">
        <PlaybackSpeedControl
          playbackRate={playbackRate}
          onIncrease={onIncreasePlaybackRate}
          onDecrease={onDecreasePlaybackRate}
          canIncrease={canIncreasePlaybackRate}
          canDecrease={canDecreasePlaybackRate}
        />
        <div className="inline-flex min-w-0 flex-1 gap-1" role="group">
          <button
            type="button"
            className="min-h-11 min-w-0 flex-1 rounded-lg bg-primary px-3 text-lg font-bold text-white"
            onClick={() => (isPlaying ? handlePause() : handlePlay({ activeTrackUrl }))}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          {showRestart && (
            <button
              type="button"
              className="min-h-11 rounded-lg bg-secondary px-3 text-sm font-bold text-white"
              onClick={handleReset}
            >
              Restart
            </button>
          )}
        </div>
        <RepeatPill repeat={repeat} onClick={onOpenRepeat} />
      </div>
    </div>
  );
};

export default PlayerActionBar;
