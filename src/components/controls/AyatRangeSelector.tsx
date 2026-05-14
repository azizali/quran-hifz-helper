import type { SURAH } from "../../_main/types";
import BookmarkIcon from "../icons/BookmarkIcon";

interface AyatRangeSelectorProps {
  ayatRange: [number, number];
  setAyatRange: React.Dispatch<React.SetStateAction<[number, number]>>;
  surah: SURAH;
  toggleCurrentSelectionBookmark: () => void;
  isBookmarked: boolean;
}

const handleAyatChange = (currentStart: number, currentEnd: number, newValue: number, isStart: boolean) => {
  if (isStart) {
    return newValue > currentEnd ? [newValue, newValue] : [newValue, currentEnd];
  }
  return newValue < currentStart ? [newValue, newValue] : [currentStart, newValue];
};

const getBookmarkButtonClass = (isBookmarked: boolean) =>
  isBookmarked
    ? "relative inline-flex h-9 w-9 items-center justify-center rounded border border-orange-500 bg-orange-500 text-white transition-colors hover:bg-orange-600"
    : "relative inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50";

const getBookmarkBadgeClass = (isBookmarked: boolean) =>
  isBookmarked
    ? "absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-700 text-[10px] font-bold leading-none text-white"
    : "absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold leading-none text-white";

export const AyatRangeSelector: React.FC<AyatRangeSelectorProps> = ({
  ayatRange,
  setAyatRange,
  surah,
  toggleCurrentSelectionBookmark,
  isBookmarked,
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
    <>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex gap-2 items-center">
          <label htmlFor="startingAyatNumber">Starting</label>
          <select
            className="border-2 rounded p-2"
            name="startingAyatNumber"
            id="startingAyatNumber"
            value={startingAyatNumber}
            onChange={(e) => handleStartingChange(parseInt(e.target.value))}
          >
            {Array.from({ length: surah.numberOfAyats }).map((_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <label htmlFor="endingAyatNumber">Ending</label>
          <select
            className="border-2 rounded p-2"
            name="endingAyatNumber"
            id="endingAyatNumber"
            value={endingAyatNumber}
            onChange={(e) => handleEndingChange(parseInt(e.target.value))}
          >
            {Array.from({
              length: surah.numberOfAyats - startingAyatNumber + 1,
            }).map((_, index) => {
              const ayatNumber = startingAyatNumber + index;
              return (
                <option key={ayatNumber} value={ayatNumber}>
                  {ayatNumber}
                </option>
              );
            })}
          </select>
        </div>
        <button
          className={getBookmarkButtonClass(isBookmarked)}
          onClick={toggleCurrentSelectionBookmark}
          aria-label={isBookmarked ? "Remove current selection bookmark" : "Add current selection to bookmark"}
          title={isBookmarked ? "Click to remove bookmark" : "Click to add bookmark"}
        >
          <BookmarkIcon
            width={16}
            height={16}
            className={isBookmarked ? "text-white" : "text-slate-600"}
          />
          <span className={getBookmarkBadgeClass(isBookmarked)} aria-hidden="true">
            {isBookmarked ? "−" : "+"}
          </span>
        </button>
      </div>
    </>
  );
};

export default AyatRangeSelector;
