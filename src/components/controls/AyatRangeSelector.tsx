import type { ReactNode } from "react";
import type { SURAH } from "../../_main/types";
import BookmarkIcon from "../icons/BookmarkIcon";

interface AyatRangeSelectorProps {
  ayatRange: [number, number];
  setAyatRange: React.Dispatch<React.SetStateAction<[number, number]>>;
  surah: SURAH;
  toggleCurrentSelectionBookmark: () => void;
  isBookmarked: boolean;
  /** Extra icon buttons shown after the bookmark button. */
  actions?: ReactNode;
}

const handleAyatChange = (currentStart: number, currentEnd: number, newValue: number, isStart: boolean) => {
  if (isStart) {
    return newValue > currentEnd ? [newValue, newValue] : [newValue, currentEnd];
  }
  return newValue < currentStart ? [newValue, newValue] : [currentStart, newValue];
};

const selectClass = "h-10 rounded border bg-white px-2 text-base tabular-nums";

export const AyatRangeSelector: React.FC<AyatRangeSelectorProps> = ({
  ayatRange,
  setAyatRange,
  surah,
  toggleCurrentSelectionBookmark,
  isBookmarked,
  actions,
}) => {
  const [startingAyatNumber, endingAyatNumber] = ayatRange;

  const handleStartingChange = (value: number) => {
    const [newStart, newEnd] = handleAyatChange(startingAyatNumber, endingAyatNumber, value, true);
    setAyatRange([newStart, newEnd]);
  };

  const handleEndingChange = (value: number) => {
    const [newStart, newEnd] = handleAyatChange(startingAyatNumber, endingAyatNumber, value, false);
    setAyatRange([newStart, newEnd]);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm text-slate-500">Ayahs</span>
      <select
        className={selectClass}
        name="startingAyatNumber"
        id="startingAyatNumber"
        aria-label="Starting ayah"
        value={startingAyatNumber}
        onChange={(e) => handleStartingChange(parseInt(e.target.value))}
      >
        {Array.from({ length: surah.numberOfAyats }).map((_, index) => (
          <option key={index + 1} value={index + 1}>
            {index + 1}
          </option>
        ))}
      </select>
      <span className="text-slate-400" aria-hidden="true">–</span>
      <select
        className={selectClass}
        name="endingAyatNumber"
        id="endingAyatNumber"
        aria-label="Ending ayah"
        value={endingAyatNumber}
        onChange={(e) => handleEndingChange(parseInt(e.target.value))}
      >
        {Array.from({ length: surah.numberOfAyats - startingAyatNumber + 1 }).map((_, index) => {
          const ayatNumber = startingAyatNumber + index;
          return (
            <option key={ayatNumber} value={ayatNumber}>
              {ayatNumber}
            </option>
          );
        })}
      </select>
      <div className="ml-auto flex shrink-0 gap-1">
        <button
          type="button"
          className={`relative grid h-9 w-9 place-items-center rounded-lg border ${
            isBookmarked
              ? "border-orange-500 bg-orange-500 text-white"
              : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50"
          }`}
          onClick={toggleCurrentSelectionBookmark}
          aria-pressed={isBookmarked}
          aria-label={isBookmarked ? "Remove bookmark for this range" : "Bookmark this range"}
          title={isBookmarked ? "Remove bookmark" : "Bookmark this range"}
        >
          <BookmarkIcon width={18} height={18} className={isBookmarked ? "text-white" : "text-slate-500"} />
        </button>
        {actions}
      </div>
    </div>
  );
};

export default AyatRangeSelector;
