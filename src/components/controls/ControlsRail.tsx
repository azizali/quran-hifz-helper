import { useEffect, useState } from "react";
import { LoopIcon, PanelOpenIcon, PauseIcon, PlayIcon, RestartIcon } from "../icons/ControlIcons";

type ControlsRailProps = {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onOpenRepeat: () => void;
  onShowControls: () => void;
  startingAyatNumber: number;
  activeAyatNumber: number;
  /** e.g. "Ayah 214 · play 2 of 3 · pass 4 of 10" */
  progressLabel: string;
  /** e.g. "3× each · 10× range" */
  repeatLabel: string;
};

// Labels show on their own for a moment when the rail appears, since touch screens have no hover.
const LABELS_VISIBLE_MS = 3500;

/**
 * Minimal playback controls shown in landscape when the controls drawer is
 * hidden. Each icon has a label on hover and keyboard focus.
 */
export const ControlsRail = ({
  isPlaying,
  onPlay,
  onPause,
  onRestart,
  onOpenRepeat,
  onShowControls,
  startingAyatNumber,
  activeAyatNumber,
  progressLabel,
  repeatLabel,
}: ControlsRailProps) => {
  const [labelsShown, setLabelsShown] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLabelsShown(false), LABELS_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const button = "rail-tip grid h-11 w-11 place-items-center rounded-[10px]";

  return (
    <nav className="player-rail" aria-label="Playback" data-labels={labelsShown ? "shown" : undefined}>
      <button
        type="button"
        onClick={onShowControls}
        data-label="Show controls"
        aria-label="Show controls"
        className={`${button} text-slate-700 hover:bg-indigo-50 hover:text-primary`}
      >
        <PanelOpenIcon />
      </button>
      <div className="my-0.5 h-px w-7 bg-slate-200" aria-hidden="true" />
      <button
        type="button"
        onClick={isPlaying ? onPause : onPlay}
        data-label={isPlaying ? "Pause" : "Play"}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={`${button} rounded-full bg-primary text-white hover:bg-indigo-700`}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        type="button"
        onClick={onRestart}
        data-label={`Restart from ${startingAyatNumber}`}
        aria-label={`Restart from ayah ${startingAyatNumber}`}
        className={`${button} text-slate-700 hover:bg-indigo-50 hover:text-primary`}
      >
        <RestartIcon />
      </button>
      <button
        type="button"
        onClick={onOpenRepeat}
        data-label={`Repeat: ${repeatLabel}`}
        aria-label={`Repeat settings: ${repeatLabel}`}
        className={`${button} text-slate-700 hover:bg-indigo-50 hover:text-primary`}
      >
        <LoopIcon />
      </button>
      {activeAyatNumber > 0 && (
        <>
          <div className="my-0.5 h-px w-7 bg-slate-200" aria-hidden="true" />
          <div
            tabIndex={0}
            data-label={progressLabel}
            aria-label={progressLabel}
            className="rail-tip grid h-11 w-11 place-items-center rounded-[10px] text-sm font-bold tabular-nums text-primary"
          >
            {activeAyatNumber}
          </div>
        </>
      )}
    </nav>
  );
};

export default ControlsRail;
