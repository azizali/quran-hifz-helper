import {
  describeRepeat,
  describeRepeatShort,
  isPlayOnce,
  MAX_REPEAT,
  REPEAT_FOREVER,
  type RepeatSettings,
} from "../hooks/quranPlayer/repeatSettings";

type RepeatControlProps = {
  repeat: RepeatSettings;
  setEach: (value: number) => void;
  setWhole: (value: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const LoopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3" />
  </svg>
);

type StepperProps = {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  display?: string;
  onChange: (value: number) => void;
};

const Stepper = ({ label, hint, value, min, max, disabled, display, onChange }: StepperProps) => (
  <div className="flex items-center justify-between gap-3">
    <div>
      <div className="font-semibold">{label}</div>
      <div className="text-xs text-slate-500">{hint}</div>
    </div>
    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">
      <button
        type="button"
        className="h-10 w-10 bg-slate-50 text-xl leading-none hover:bg-indigo-50 disabled:text-slate-300"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Fewer ${label.toLowerCase()}`}
      >
        −
      </button>
      <output className="w-12 text-center font-bold tabular-nums" aria-label={`${label} count`}>
        {display ?? `${value}×`}
      </output>
      <button
        type="button"
        className="h-10 w-10 bg-slate-50 text-xl leading-none hover:bg-indigo-50 disabled:text-slate-300"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`More ${label.toLowerCase()}`}
      >
        +
      </button>
    </div>
  </div>
);

/** Pill for the player bar. Quiet ("Play once") until the user turns repeats on. */
export const RepeatPill = ({ repeat, onClick }: { repeat: RepeatSettings; onClick: () => void }) => {
  const active = !isPlayOnce(repeat);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Repeat settings: ${describeRepeat(repeat)}`}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-2.5 text-xs font-semibold ${
        active
          ? "border-indigo-200 bg-indigo-50 text-primary"
          : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      <LoopIcon />
      <span className="sm:hidden">{describeRepeatShort(repeat)}</span>
      <span className="hidden sm:inline">{describeRepeat(repeat)}</span>
    </button>
  );
};

/** Bottom sheet with the repeat counts. */
export const RepeatSheet = ({ repeat, setEach, setWhole, open, onOpenChange }: RepeatControlProps) => {
  if (!open) return null;
  const loop = repeat.whole === REPEAT_FOREVER;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close repeat settings"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-label="Repeat settings"
        className="safe-area-y relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-lg animate-slide-in-up"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded bg-slate-300" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Repeat</h2>
          <button
            type="button"
            className="px-1 py-1 text-sm font-bold text-primary"
            onClick={() => onOpenChange(false)}
          >
            Done
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <Stepper
            label="Each ayat"
            hint="Plays this many times in a row"
            value={repeat.each}
            min={1}
            max={MAX_REPEAT}
            onChange={setEach}
          />
          <Stepper
            label="Whole range"
            hint="Then starts the range over"
            value={loop ? MAX_REPEAT : repeat.whole}
            min={1}
            max={MAX_REPEAT}
            disabled={loop}
            display={loop ? "∞" : undefined}
            onChange={setWhole}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setWhole(e.target.checked ? REPEAT_FOREVER : 1)}
            />
            Keep repeating the range until I stop
          </label>
        </div>
      </div>
    </div>
  );
};
