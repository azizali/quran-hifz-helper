import { surahs } from "../../_main/config";
import ChevronDownIcon from "../icons/ChevronDownIcon";
import { selectChevronClass, selectClass } from "./selectStyles";

interface SurahSelectorProps {
  surahNumber: number;
  setSurahNumber: React.Dispatch<React.SetStateAction<number>>;
  setAyatRange: React.Dispatch<React.SetStateAction<[number, number]>>;
}

/** Native select, one tap to change. A new surah starts with all its ayat selected. */
export const SurahSelector: React.FC<SurahSelectorProps> = ({
  surahNumber,
  setSurahNumber,
  setAyatRange,
}) => (
  <label className="relative flex min-h-11 min-w-0 flex-1 items-center">
    <span className="sr-only">Surah</span>
    <select
      className={selectClass}
      name="surah"
      id="surah"
      value={surahNumber}
      onChange={(e) => {
        const selectedSurahNumber = parseInt(e.target.value);
        setSurahNumber(selectedSurahNumber);
        setAyatRange([1, surahs[selectedSurahNumber - 1].numberOfAyats]);
      }}
    >
      {surahs.map(({ number, name, numberOfAyats }) => (
        <option key={number} value={number}>
          {number}. {name} ({numberOfAyats})
        </option>
      ))}
    </select>
    <ChevronDownIcon className={selectChevronClass} />
  </label>
);

export default SurahSelector;
