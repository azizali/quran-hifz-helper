import type { QariKey } from "../components/controls/qari";
import { getTracksToPlay } from "../components/utils";

// In the browser, "saved on this device" means saved in the same Cache Storage
// bucket the service worker already serves audio from (see vite.config.ts), so
// playback picks the saved ayat up with no other changes.
const AUDIO_CACHE = "audio-cache";
const FETCH_TIMEOUT_MS = 30_000;

type Change = "added" | "removed";
const listeners = new Set<(change: Change) => void>();
export const subscribeToWebDownloadChanges = (listener: (change: Change) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isWebStorageAvailable = () => typeof caches !== "undefined";

const urlFor = (surahNumber: number, qariKey: QariKey, ayatNumber: number) =>
  getTracksToPlay([ayatNumber, ayatNumber], surahNumber, qariKey)[0].trackUrl;

export async function getWebDownloadedAyahs(
  surahNumber: number,
  qariKey: QariKey,
  numberOfAyats: number
): Promise<Set<number>> {
  if (!isWebStorageAvailable()) return new Set();
  const cache = await caches.open(AUDIO_CACHE);
  const cachedUrls = new Set((await cache.keys()).map((request) => request.url));
  const saved = new Set<number>();
  for (let n = 1; n <= numberOfAyats; n++) {
    if (cachedUrls.has(urlFor(surahNumber, qariKey, n))) saved.add(n);
  }
  return saved;
}

export async function downloadWebAyahs(
  surahNumber: number,
  qariKey: QariKey,
  ayatNumbers: number[],
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const cache = await caches.open(AUDIO_CACHE);
  let loaded = 0;
  onProgress?.(0, ayatNumbers.length);
  try {
    for (const n of ayatNumbers) {
      const url = urlFor(surahNumber, qariKey, n);
      if (!(await cache.match(url))) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
          await cache.put(url, response);
        } catch (err) {
          throw controller.signal.aborted ? new Error("the connection timed out") : err;
        } finally {
          clearTimeout(timeout);
        }
      }
      loaded++;
      onProgress?.(loaded, ayatNumbers.length);
    }
  } finally {
    if (loaded > 0) listeners.forEach((listener) => listener("added"));
  }
}

export async function deleteWebAyahs(
  surahNumber: number,
  qariKey: QariKey,
  ayatNumbers: number[]
): Promise<void> {
  const cache = await caches.open(AUDIO_CACHE);
  for (const n of ayatNumbers) await cache.delete(urlFor(surahNumber, qariKey, n));
  listeners.forEach((listener) => listener("removed"));
}
