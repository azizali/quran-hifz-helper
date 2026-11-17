/**
 * The Quran text styles the reader can choose, and the tajweed colour rules.
 * Text files live in public/quran-text (see scripts/fetch-quran-text.mjs).
 */

export type QuranScript = "uthmani" | "indopak" | "naskh";

/** A run of tajweed text: plain, or [rule, letters] to colour. */
export type TajweedSegment = string | [rule: string, text: string];
/** One ayah: plain text, or tajweed runs when colours are on. */
export type AyahText = string | TajweedSegment[];

export type TextVariant = QuranScript | "tajweed";

export const QURAN_SCRIPTS: { id: QuranScript; label: string; hint: string; sample: string }[] = [
  {
    id: "uthmani",
    label: "Uthmani",
    hint: "Madani mushaf, King Fahd Complex font",
    sample: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
  },
  {
    id: "indopak",
    label: "IndoPak",
    hint: "South Asian mushaf, Nastaleeq font",
    sample: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِیْمِ",
  },
  {
    id: "naskh",
    label: "Naskh",
    hint: "Plain Naskh, Amiri font",
    sample: "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ",
  },
];

/** Tajweed colours follow the Uthmani text, so they need that script. */
export const textVariantFor = (script: QuranScript, tajweed: boolean): TextVariant =>
  script === "uthmani" && tajweed ? "tajweed" : script;

/** The file for one surah. Naskh keeps its original location. */
export const textPath = (variant: TextVariant, surahNumber: number) =>
  variant === "naskh" ? `quran-text/${surahNumber}.json` : `quran-text/${variant}/${surahNumber}.json`;

/** Legend for the colours in global.css (.tj-<rule>), in the order a reader learns them. */
export const TAJWEED_LEGEND: { label: string; rules: string[] }[] = [
  { label: "Ghunnah", rules: ["ghunnah"] },
  { label: "Ikhfa", rules: ["ikhafa", "ikhafa_shafawi"] },
  { label: "Idgham with ghunnah", rules: ["idgham_ghunnah", "idgham_shafawi"] },
  { label: "Idgham without ghunnah", rules: ["idgham_wo_ghunnah"] },
  { label: "Iqlab", rules: ["iqlab"] },
  { label: "Qalqalah", rules: ["qalaqah"] },
  { label: "Madd, 2 counts", rules: ["madda_normal"] },
  { label: "Madd, 2, 4 or 6", rules: ["madda_permissible"] },
  { label: "Madd, 4 or 5", rules: ["madda_obligatory"] },
  { label: "Madd, 6 counts", rules: ["madda_necessary"] },
  { label: "Not pronounced", rules: ["ham_wasl", "laam_shamsiyah", "slnt"] },
];
