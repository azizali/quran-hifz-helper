import { useEffect, useState } from "react";

// Arabic text ships with the app (public/quran-text/<surah>.json), so it
// works offline on web, iOS and Android. One small file per surah.
const cache = new Map<number, string[]>();

/** Returns the ayat text of a surah (index 0 = ayat 1), or null while loading. */
export function useSurahText(surahNumber: number): string[] | null {
  const [text, setText] = useState<string[] | null>(cache.get(surahNumber) ?? null);

  useEffect(() => {
    const cached = cache.get(surahNumber);
    if (cached) {
      setText(cached);
      return;
    }
    setText(null);
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}quran-text/${surahNumber}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<string[]>) : Promise.reject(new Error(String(res.status)))))
      .then((verses) => {
        cache.set(surahNumber, verses);
        if (!cancelled) setText(verses);
      })
      .catch(() => {
        // Text is an enhancement; the list falls back to plain labels.
      });
    return () => {
      cancelled = true;
    };
  }, [surahNumber]);

  return text;
}
