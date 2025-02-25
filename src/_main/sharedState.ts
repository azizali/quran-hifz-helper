import { atom } from "nanostores";
import { selected } from "./config";
import mufhases, { type Mufhas } from "./mufhas";
import type { Reciter } from "./reciters";
import reciters from "./reciters";
import { surahs, type Surah } from "./surahs";
import { type Track } from "./types";

// Audio
export const activeTrack = atom<Track>("001001" as Track);
export const isAudioSyncedWithPage = atom<boolean>(false);
export const selectedReciter = atom<Reciter>(reciters[selected.reciterKey]);

export const activePageNumber = atom<number>(2);

export const selectedMufhas = atom<Mufhas>(mufhases[selected.mufhasId]);
export const selectedSurah = atom<Surah>(surahs[selected.surahNumber - 1]);

export const startingAyatNum = atom<number>(1);
export const endingAyatNum = atom<number>(7);
