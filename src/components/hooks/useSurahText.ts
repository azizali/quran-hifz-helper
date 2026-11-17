import { useEffect, useState } from "react";
import { textPath, type AyahText, type TextVariant } from "../quranText";

// Arabic text ships with the app (public/quran-text), so it works offline on
// web, iOS and Android. One small file per surah and text style.
const cache = new Map<string, AyahText[]>();

/** Returns the ayat text of a surah (index 0 = ayat 1), or null while loading. */
export function useSurahText(surahNumber: number, variant: TextVariant = "naskh"): AyahText[] | null {
  const path = textPath(variant, surahNumber);
  const [text, setText] = useState<AyahText[] | null>(cache.get(path) ?? null);

  useEffect(() => {
    const cached = cache.get(path);
    if (cached) {
      setText(cached);
      return;
    }
    setText(null);
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}${path}`)
      .then((res) => (res.ok ? (res.json() as Promise<AyahText[]>) : Promise.reject(new Error(String(res.status)))))
      .then((verses) => {
        cache.set(path, verses);
        if (!cancelled) setText(verses);
      })
      .catch(() => {
        // Text is an enhancement; the list falls back to plain labels.
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return text;
}
