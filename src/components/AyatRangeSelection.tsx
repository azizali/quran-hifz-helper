import { useStore } from "@nanostores/react";
import { ayatRange, selectedSurah } from "../_main/sharedState";

const AyatRangeSelection = () => {
  const [startingAyatNumber, endingAyatNumber] = useStore(ayatRange);
  const $selectedSurah = useStore(selectedSurah);

  return (
    <div className="flex gap-2">
      <div className="flex gap-2 items-center">
        <label htmlFor="startingAyatNumber">Starting</label>
        <select
          className="border-2 rounded p-2"
          name="startingAyatNumber"
          id="startingAyatNumber"
          value={startingAyatNumber}
          onChange={(e) => {
            ayatRange.set([parseInt(e.target.value), endingAyatNumber]);
          }}
        >
          {Array.from({ length: $selectedSurah.totalVerses }).map(
            (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            )
          )}
        </select>
      </div>
      <div className="flex gap-2 items-center">
        <label htmlFor="endingAyatNumber">Ending</label>
        <select
          className="border-2 rounded p-2"
          name="endingAyatNumber"
          id="endingAyatNumber"
          value={endingAyatNumber}
          onChange={(e) => {
            ayatRange.set([startingAyatNumber, parseInt(e.target.value)]);
          }}
        >
          {Array.from({
            length: $selectedSurah.totalVerses - startingAyatNumber + 1,
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
    </div>
  );
};

export default AyatRangeSelection;
