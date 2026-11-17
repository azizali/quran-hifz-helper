import BookmarkIcon from "../icons/BookmarkIcon";
import ChevronDownIcon from "../icons/ChevronDownIcon";
import { selectChevronClass, selectClass } from "./selectStyles";

export type PlayerMode = "listen" | "memorize";

type RangeBarProps = {
  ayatRange: [number, number];
  numberOfAyats: number;
  onRangeChange: (range: [number, number]) => void;
  /** First ayah tapped in the list while choosing a range; waiting for the last. */
  pendingStart: number | null;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  mode: PlayerMode;
  onModeChange: (mode: PlayerMode) => void;
  memorization?: {
    counts: { memorized: number; revise: number; fresh: number };
    anyRevealed: boolean;
    onToggleRevealAll: () => void;
  };
};


const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

type AyahSelectProps = {
  id: string;
  label: string;
  value: number | "";
  options: number[];
  disabled?: boolean;
  onChange: (value: number) => void;
};

/** Native select: one tap opens the system picker, which scrolls well even with 286 ayat. */
const AyahSelect = ({ id, label, value, options, disabled, onChange }: AyahSelectProps) => (
  <label className="flex flex-col gap-1" htmlFor={id}>
    <span className="pl-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    <span className="relative flex w-24 items-center">
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className={selectClass}
      >
        {value === "" && <option value="">–</option>}
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <ChevronDownIcon className={selectChevronClass} />
    </span>
  </label>
);

/**
 * The range is picked from the From and To dropdowns, or by tapping ayah
 * numbers in the list. To only offers ayat from the start onward.
 */
export const RangeBar = ({
  ayatRange,
  numberOfAyats,
  onRangeChange,
  pendingStart,
  isBookmarked,
  onToggleBookmark,
  mode,
  onModeChange,
  memorization,
}: RangeBarProps) => {
  const [start, end] = ayatRange;
  const picking = pendingStart !== null;
  const count = end - start + 1;
  const isWholeSurah = start === 1 && end === numberOfAyats;

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-3 pt-2 pb-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <AyahSelect
            id="range-from"
            label="From"
            value={picking ? pendingStart : start}
            options={range(1, numberOfAyats)}
            disabled={picking}
            // A start after the current end moves the end with it.
            onChange={(from) => onRangeChange([from, Math.max(from, end)])}
          />
          <span className="pb-2.5 text-slate-400" aria-hidden="true">
            –
          </span>
          <AyahSelect
            id="range-to"
            label="To"
            value={picking ? "" : end}
            options={range(start, numberOfAyats)}
            disabled={picking}
            onChange={(to) => onRangeChange([start, to])}
          />
        </div>
        <button
          type="button"
          onClick={onToggleBookmark}
          disabled={picking}
          aria-pressed={isBookmarked}
          aria-label={isBookmarked ? "Remove this range from bookmarks" : "Bookmark this range"}
          className={`flex min-h-11 items-center gap-1 px-2 text-sm font-semibold disabled:opacity-40 ${
            isBookmarked ? "text-primary" : "text-slate-600"
          }`}
        >
          <BookmarkIcon filled={isBookmarked} />
          <span>{isBookmarked ? "Saved" : "Save"}</span>
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
          <span className={`truncate ${picking ? "font-semibold text-primary" : ""}`} aria-live="polite">
            {picking
              ? "Tap the last ayah of the range."
              : `${count} of ${numberOfAyats} ayahs${isWholeSurah ? " · whole surah" : ""}`}
          </span>
          {!picking && !isWholeSurah && (
            <button
              type="button"
              onClick={() => onRangeChange([1, numberOfAyats])}
              className="min-h-9 shrink-0 font-semibold text-primary"
            >
              Select all
            </button>
          )}
        </div>
        <div className="flex w-44 shrink-0 gap-0.5 rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Mode">
          {(["listen", "memorize"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onModeChange(value)}
              aria-pressed={mode === value}
              className={`min-h-9 flex-1 rounded-md px-3 text-xs font-semibold ${
                mode === value ? "bg-white text-primary shadow-sm" : "text-slate-600"
              }`}
            >
              {value === "listen" ? "Listen" : "Memorize"}
            </button>
          ))}
        </div>
      </div>

      {memorization && (
        <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
          <span className="flex flex-wrap items-center gap-x-3 tabular-nums">
            {(
              [
                ["memorized", memorization.counts.memorized, "memorized"],
                ["revise", memorization.counts.revise, "to revise"],
                ["new", memorization.counts.fresh, "new"],
              ] as const
            ).map(([status, count, label]) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span className="status-mark" data-status={status} aria-hidden="true" />
                {count} {label}
              </span>
            ))}
          </span>
          <button
            type="button"
            onClick={memorization.onToggleRevealAll}
            className="min-h-9 px-1 font-semibold text-slate-600 hover:text-primary"
          >
            {memorization.anyRevealed ? "Hide all" : "Show all"}
          </button>
        </div>
      )}
    </div>
  );
};

export default RangeBar;
