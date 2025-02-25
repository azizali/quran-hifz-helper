import { useStore } from "@nanostores/react";
import mufhases from "../_main/mufhas";
import { selectedMufhas } from "../_main/sharedState";

const MufhasSelection = () => {
  const $selectedMufhas = useStore(selectedMufhas);
  console.log({ selectedMufhas });
  return (
    <div>
      <label htmlFor="surah">Mufhas</label>
      <select
        className="border-2 rounded p-2 w-full"
        name="surah"
        id="surah"
        value={$selectedMufhas.id}
        size={1}
        onChange={(e) => {
          const mufhasId = e.target.value;
          selectedMufhas.set(mufhases[mufhasId]);
        }}
      >
        {Object.keys(mufhases).map((key) => (
          <option key={key} value={key}>
            {mufhases[key].name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MufhasSelection;
