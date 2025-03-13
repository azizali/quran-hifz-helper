import { useStore } from "@nanostores/react";
import { shouldRepeat } from "../_main/sharedState";
import AyatRangeSelection from "./AyatRangeSelection";
import ReciterSelection from "./ReciterSelection";

const SimplePlayer = () => {
  const $shouldRepeat = useStore(shouldRepeat);
  return (
    <div className="flex justify-between items-center">
      <ReciterSelection />
      <AyatRangeSelection />
      <label className="flex gap-2" htmlFor="shouldRepeat">
        <input
          type="checkbox"
          name="shouldRepeat"
          id="shouldRepeat"
          checked={$shouldRepeat}
          onChange={() => shouldRepeat.set(!$shouldRepeat)}
        />
        Repeat
      </label>
      <button>Play</button>
    </div>
  );
};

export default SimplePlayer;
