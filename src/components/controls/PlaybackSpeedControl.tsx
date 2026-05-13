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

const PlaybackSpeedControl = ({
  playbackRate,
  onDecrease,
  onIncrease,
  canDecrease,
  canIncrease,
}: PlaybackSpeedControlProps) => {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-2 py-1">
      <span className="text-xs font-semibold text-slate-600">Speed</span>
      <button
        type="button"
        className="h-7 w-7 rounded border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onDecrease}
        disabled={!canDecrease}
        aria-label="Decrease playback speed"
      >
        -
      </button>
      <div className="min-w-12 text-center text-sm font-semibold text-slate-700">
        {formatRate(playbackRate)}x
      </div>
      <button
        type="button"
        className="h-7 w-7 rounded border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onIncrease}
        disabled={!canIncrease}
        aria-label="Increase playback speed"
      >
        +
      </button>
    </div>
  );
};

export default PlaybackSpeedControl;