import { useStore } from "@nanostores/react";
import { selectedSurah } from "../_main/sharedState";
import { surahs } from "../_main/surahs";

const SurahSelection = () => {
  const $activeSurah = useStore(selectedSurah);

  return (
    <div>
      <label htmlFor="surah">Surah</label>
      <select
        className="border-2 rounded p-2 w-full"
        name="surah"
        id="surah"
        value={$activeSurah.id}
        size={1}
        onChange={(e) => {
          const surahNumber = parseInt(e.target.value);
          const surah = surahs[surahNumber];
          selectedSurah.set(surah);
        }}
      >
        {Object.keys(surahs).map((surahId) => {
          const { id, transliteration } = surahs[parseInt(surahId)];
          return (
            <option key={transliteration} value={id}>
              {id}. {transliteration}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default SurahSelection;
