import type { Surah } from "../_main/surahs";

interface AyatListProps {
  surahNumber: number;
  setSurahNumber: React.Dispatch<React.SetStateAction<number>>;
  startingAyatNumber: number;
  setStartingAyatNumber: React.Dispatch<React.SetStateAction<number>>;
  endingAyatNumber: number;
  setEndingAyatNumber: React.Dispatch<React.SetStateAction<number>>;
  surah: Surah;
  surahs: Surah[];
}

export const PlayControls: React.FC<AyatListProps> = ({
  surahNumber,
  setSurahNumber,
  startingAyatNumber,
  setStartingAyatNumber,
  endingAyatNumber,
  setEndingAyatNumber,
  surah,
  surahs,
}) => {
  return (
    <>
      <div>
        <label htmlFor="surah">Surah</label>
        <select
          className="border-2 rounded p-2 w-full"
          name="surah"
          id="surah"
          value={surahNumber}
          size={1}
          onChange={(e) => {
            const surahNumber = parseInt(e.target.value);
            setSurahNumber(surahNumber);
            const surah = surahs[surahNumber - 1];
            setStartingAyatNumber(1);
            setEndingAyatNumber(surah.totalVerses);
          }}
        >
          {surahs.map(({ id, name, translation }) => (
            <option key={name} value={id}>
              {id}. {name}: {translation}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <div className="flex gap-2 items-center">
          <label htmlFor="startingAyatNumber">Starting</label>
          <select
            className="border-2 rounded p-2"
            name="startingAyatNumber"
            id="startingAyatNumber"
            value={startingAyatNumber}
            onChange={(e) => {
              setStartingAyatNumber(parseInt(e.target.value));
            }}
          >
            {Array.from({ length: surah.totalVerses }).map((_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
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
              setEndingAyatNumber(parseInt(e.target.value));
            }}
          >
            {Array.from({
              length: surah.totalVerses - startingAyatNumber + 1,
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
    </>
  );
};

export default PlayControls;
