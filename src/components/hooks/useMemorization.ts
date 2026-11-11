import { useCallback, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

/** memorized, or marked to revise. An ayat with no entry is "new". */
export type MemorizationStatus = "memorized" | "revise";

type MemorizationStore = Record<string, Record<string, MemorizationStatus>>;

export const nextStatus = (status: MemorizationStatus | undefined): MemorizationStatus | undefined =>
  status === undefined ? "memorized" : status === "memorized" ? "revise" : undefined;

/** Per-surah memorization marks, saved on this device. */
export function useMemorization(surahNumber: number, numberOfAyats: number) {
  const [store, setStore] = useLocalStorage<MemorizationStore>("memorization", {});

  const statuses = useMemo(() => store[surahNumber] ?? {}, [store, surahNumber]);

  const cycle = useCallback(
    (ayatNumber: number) => {
      setStore((current) => {
        const surahMarks = { ...(current[surahNumber] ?? {}) };
        const next = nextStatus(surahMarks[ayatNumber]);
        if (next) surahMarks[ayatNumber] = next;
        else delete surahMarks[ayatNumber];

        const updated = { ...current };
        if (Object.keys(surahMarks).length > 0) updated[surahNumber] = surahMarks;
        else delete updated[surahNumber];
        return updated;
      });
    },
    [setStore, surahNumber]
  );

  const counts = useMemo(() => {
    let memorized = 0;
    let revise = 0;
    for (const status of Object.values(statuses)) {
      if (status === "memorized") memorized++;
      else revise++;
    }
    return { memorized, revise, fresh: numberOfAyats - memorized - revise };
  }, [statuses, numberOfAyats]);

  return { statuses, cycle, counts };
}
