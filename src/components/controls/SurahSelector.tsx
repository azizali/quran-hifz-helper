import { surahs } from "../../_main/config";
import SelectField from "./SelectField";
interface SurahSelectorProps {
  surahNumber: number;
  setSurahNumber: React.Dispatch<React.SetStateAction<number>>;
  setAyatRange: React.Dispatch<React.SetStateAction<[number, number]>>;
}

export const SurahSelector: React.FC<SurahSelectorProps> = ({
  surahNumber,
  setSurahNumber,
  setAyatRange,
}) => {
  return (
    <SelectField label="Surah" htmlFor="surah">
      <select
        className="border-2 rounded p-2 w-full"
        name="surah"
        id="surah"
        value={surahNumber}
        size={1}
        onChange={(e) => {
          const selectedSurahNumber = parseInt(e.target.value);
          setSurahNumber(selectedSurahNumber);
          const surah = surahs[selectedSurahNumber - 1];
          setAyatRange([1, surah.numberOfAyats]);
        }}
      >
        {surahs.map(({ number, name, nameEnglish }) => (
          <option key={name} value={number}>
            {number}. {name}: {nameEnglish}
          </option>
        ))}
      </select>
    </SelectField>
  );
};

export default SurahSelector;
