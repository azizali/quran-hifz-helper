import { useCallback, useEffect, useRef, useState } from "react";
import { isNativePlatform } from "../../_main/platform";
import {
  deleteAyahs,
  downloadAyahs,
  getAverageAyahBytes,
  getDownloadedAyahs,
  subscribeToDownloadChanges,
} from "../../native-audio/downloadManager";
import {
  deleteWebAyahs,
  downloadWebAyahs,
  getWebDownloadedAyahs,
  isWebStorageAvailable,
  subscribeToWebDownloadChanges,
} from "../../native-audio/webDownloads";
import { surahs } from "../../_main/config";
import type { QariKey } from "../controls/qari";

// Used for the size estimate until some ayat of the surah are saved.
const FALLBACK_AYAH_BYTES = 100 * 1024;

export type DownloadProgress = { loaded: number; total: number };

/** Can this device save ayat for offline use? Native uses files, the browser uses its cache. */
export const canSaveOffline = () => isNativePlatform() || isWebStorageAvailable();

/** Which ayat of a surah are saved on this device, plus download and delete actions. */
export function useOfflineAyahs(surahNumber: number, qariKey: QariKey) {
  const [downloaded, setDownloaded] = useState<Set<number>>(new Set());
  const [avgBytes, setAvgBytes] = useState(FALLBACK_AYAH_BYTES);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef({ surahNumber, qariKey });
  latest.current = { surahNumber, qariKey };

  const refresh = useCallback(async () => {
    if (!canSaveOffline()) return;
    const { surahNumber: s, qariKey: q } = latest.current;
    const [saved, average] = isNativePlatform()
      ? await Promise.all([getDownloadedAyahs(s, q), getAverageAyahBytes(s, q)])
      : [await getWebDownloadedAyahs(s, q, surahs[s - 1].numberOfAyats), null];
    if (latest.current.surahNumber !== s || latest.current.qariKey !== q) return;
    setDownloaded(saved);
    setAvgBytes(average ?? FALLBACK_AYAH_BYTES);
  }, []);

  useEffect(() => {
    setError(null);
    refresh();
    const subscribe = isNativePlatform() ? subscribeToDownloadChanges : subscribeToWebDownloadChanges;
    return subscribe(() => {
      refresh();
    });
  }, [surahNumber, qariKey, refresh]);

  const download = useCallback(
    async (ayatNumbers: number[]) => {
      setError(null);
      setProgress({ loaded: 0, total: ayatNumbers.length });
      try {
        const run = isNativePlatform() ? downloadAyahs : downloadWebAyahs;
        await run(surahNumber, qariKey, ayatNumbers, (loaded, total) => setProgress({ loaded, total }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setProgress(null);
        refresh();
      }
    },
    [surahNumber, qariKey, refresh]
  );

  const remove = useCallback(
    async (ayatNumbers: number[]) => {
      await (isNativePlatform() ? deleteAyahs : deleteWebAyahs)(surahNumber, qariKey, ayatNumbers);
      refresh();
    },
    [surahNumber, qariKey, refresh]
  );

  return { downloaded, avgBytes, progress, error, download, remove };
}
