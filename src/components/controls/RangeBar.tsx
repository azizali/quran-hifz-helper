import { useEffect, useState } from "react";
import BookmarkIcon from "../icons/BookmarkIcon";

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const numberInputClass =
  "h-11 w-20 rounded-lg border border-slate-300 bg-white px-2 text-center text-lg font-bold tabular-nums text-slate-900 focus:border-primary disabled:bg-slate-50";

/**
 * The range is typed in From and To, or picked by tapping numbers in the list.
 * Values commit on blur or Enter, so typing "2" on the way to "205" does not
 * rebuild the audio.
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
  const [fromDraft, setFromDraft] = useState(String(start));
  const [toDraft, setToDraft] = useState(String(end));

  useEffect(() => {
    setFromDraft(String(start));
    setToDraft(String(end));
  }, [start, end]);

  const commit = (edited: "from" | "to") => {
    let from = clamp(parseInt(fromDraft, 10) || start, 1, numberOfAyats);
    let to = clamp(parseInt(toDraft, 10) || end, 1, numberOfAyats);
    if (from > to) {
      if (edited === "from") to = from;
      else from = to;
    }
    setFromDraft(String(from));
    setToDraft(String(to));
    if (from !== start || to !== end) onRangeChange([from, to]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  const picking = pendingStart !== null;
  const count = end - start + 1;
  const isWholeSurah = start === 1 && end === numberOfAyats;

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-3 pt-2 pb-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">From</span>
            <input
              id="range-from"
              type="number"
              inputMode="numeric"
              min={1}
              max={numberOfAyats}
              value={picking ? String(pendingStart) : fromDraft}
              disabled={picking}
              onChange={(e) => setFromDraft(e.target.value)}
              onBlur={() => commit("from")}
              onKeyDown={onKeyDown}
              className={numberInputClass}
            />
          </label>
          <span className="pb-2.5 text-slate-400" aria-hidden="true">
            –
          </span>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">To</span>
            <input
              id="range-to"
              type="number"
              inputMode="numeric"
              min={1}
              max={numberOfAyats}
              value={picking ? "" : toDraft}
              placeholder={picking ? "tap" : undefined}
              disabled={picking}
              onChange={(e) => setToDraft(e.target.value)}
              onBlur={() => commit("to")}
              onKeyDown={onKeyDown}
              className={numberInputClass}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={onToggleBookmark}
          disabled={picking}
          aria-pressed={isBookmarked}
          aria-label={isBookmarked ? "Remove this range from bookmarks" : "Bookmark this range"}
          className={`flex min-h-11 items-center gap-1 px-2 text-sm font-semibold disabled:opacity-40 ${
            isBookmarked ? "text-orange-600" : "text-slate-600"
          }`}
        >
          <BookmarkIcon filled={isBookmarked} />
          <span>{isBookmarked ? "Saved" : "Save"}</span>
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
          <span className={`truncate ${picking ? "font-semibold text-orange-700" : ""}`} aria-live="polite">
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
          <span>
            {memorization.counts.memorized} memorized · {memorization.counts.revise} to revise ·{" "}
            {memorization.counts.fresh} new
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
