import { useStore } from "@nanostores/react";
import reciters from "../_main/reciters";
import { selectedReciter } from "../_main/sharedState";

const ReciterSelection = () => {
  const $selectedReciter = useStore(selectedReciter);
  return (
    <div>
      <label htmlFor="surah">Reciter</label>
      <select
        className="border-2 rounded p-2 w-full"
        name="surah"
        id="surah"
        value={$selectedReciter.id}
        size={1}
        onChange={(e) => {
          const reciterKey = e.target.value;
          selectedReciter.set(reciters[reciterKey]);
        }}
      >
        {Object.keys(reciters).map((key) => (
          <option key={key} value={key}>
            {reciters[key].name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ReciterSelection;
