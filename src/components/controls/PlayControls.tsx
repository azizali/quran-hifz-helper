import type { SURAH } from "../../_main/types";
import AyatRangeSelector from "./AyatRangeSelector";
import QariSelector from "./QariSelector";
import SurahSelector from "./SurahSelector";
import type { QariKey } from "./qari";

interface PlayerControlsProps {
  qariKey: QariKey;
  setQariKey: React.Dispatch<React.SetStateAction<QariKey>>;
  surahNumber: number;
  setSurahNumber: React.Dispatch<React.SetStateAction<number>>;
  ayatRange: [number, number];
  setAyatRange: React.Dispatch<React.SetStateAction<[number, number]>>;
  surah: SURAH;
  toggleCurrentSelectionBookmark: () => void;
  isBookmarked: boolean;
}

export const PlayControls: React.FC<PlayerControlsProps> = ({
  qariKey,
  setQariKey,
  surahNumber,
  setSurahNumber,
  ayatRange,
  setAyatRange,
  surah,
  toggleCurrentSelectionBookmark,
  isBookmarked,
}) => {
  return (
    <>
      <QariSelector qariKey={qariKey} setQariKey={setQariKey} />
      <SurahSelector
        surahNumber={surahNumber}
        setSurahNumber={setSurahNumber}
        setAyatRange={setAyatRange}
      />
      <AyatRangeSelector
        ayatRange={ayatRange}
        setAyatRange={setAyatRange}
        surah={surah}
        toggleCurrentSelectionBookmark={toggleCurrentSelectionBookmark}
        isBookmarked={isBookmarked}
      />
    </>
  );
};

export default PlayControls;
