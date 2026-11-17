import ChevronDownIcon from "../icons/ChevronDownIcon";
import qaris, { type QariKey } from "./qari";
import { selectChevronClass, selectClass } from "./selectStyles";

interface QariSelectorProps {
  qariKey: QariKey;
  setQariKey: React.Dispatch<React.SetStateAction<QariKey>>;
}

/** Full-width native select: one tap opens the system picker. */
export const QariSelector: React.FC<QariSelectorProps> = ({ qariKey, setQariKey }) => (
  <label className="relative flex min-h-11 items-center">
    <span className="sr-only">Qari</span>
    <select
      className={selectClass}
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
    <ChevronDownIcon className={selectChevronClass} />
  </label>
);

export default QariSelector;
