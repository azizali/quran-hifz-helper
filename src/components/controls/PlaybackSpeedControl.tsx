type PlaybackSpeedControlProps = {
  playbackRate: number;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease: boolean;
  canIncrease: boolean;
};

const formatRate = (rate: number) => {
  const fixedRate = rate.toFixed(2);
  return fixedRate.endsWith(".00") ? fixedRate.slice(0, -3) : fixedRate;
};

const stepButton =
  "h-8 w-6 bg-slate-50 text-base leading-none text-slate-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40";

const PlaybackSpeedControl = ({
  playbackRate,
  onDecrease,
  onIncrease,
  canDecrease,
  canIncrease,
}: PlaybackSpeedControlProps) => {
  return (
    <div
      className="flex shrink-0 items-center overflow-hidden rounded-lg border border-slate-200"
      role="group"
      aria-label="Playback speed"
    >
      <button type="button" className={stepButton} onClick={onDecrease} disabled={!canDecrease} aria-label="Decrease playback speed">
        −
      </button>
      <div className="w-9 text-center text-xs font-semibold tabular-nums text-slate-700" aria-live="polite">
        {formatRate(playbackRate)}×
      </div>
      <button type="button" className={stepButton} onClick={onIncrease} disabled={!canIncrease} aria-label="Increase playback speed">
        +
      </button>
    </div>
  );
};

export default PlaybackSpeedControl;
