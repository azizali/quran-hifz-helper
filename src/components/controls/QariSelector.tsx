import ChevronDownIcon from "../icons/ChevronDownIcon";
import qaris, { type QariKey } from "./qari";

interface QariSelectorProps {
  qariKey: QariKey;
  setQariKey: React.Dispatch<React.SetStateAction<QariKey>>;
}

/** Full-width native select: one tap opens the system picker. */
export const QariSelector: React.FC<QariSelectorProps> = ({ qariKey, setQariKey }) => (
  <label className="relative flex min-h-11 items-center">
    <span className="sr-only">Qari</span>
    <select
      className="h-11 w-full min-w-0 appearance-none truncate rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-base text-slate-700"
      name="qari"
      id="qari"
      value={qariKey}
      onChange={(e) => setQariKey(e.target.value as QariKey)}
    >
      {Object.keys(qaris).map((key) => (
        <option key={key} value={key}>
          {qaris[key as QariKey].name}
        </option>
      ))}
    </select>
    <ChevronDownIcon className="pointer-events-none absolute right-3 text-slate-500" />
  </label>
);

export default QariSelector;
