import { atom } from "nanostores";
import { appName, selected } from "./config";
import mufhases, { type Mufhas } from "./mufhas";
import type { Reciter } from "./reciters";
import reciters from "./reciters";
import { mufhasSurahAyatPage } from "./surahAyatToPage";
import { surahs, type Surah } from "./surahs";
import { type Track } from "./types";
import { parseSurahAyatFromTrack } from "./utils";

export const showHeaderFooter = atom<boolean>(true);

// Audio
export const shouldRepeat = atom<boolean>(true);
export const activeTrack = atom<Track>("001001" as Track);
export const isAudioSyncedWithPage = atom<boolean>(false);
export const selectedReciter = atom<Reciter>(reciters[selected.reciterKey]);

export const activePageNumber = atom<number>(2);

export const selectedMufhas = atom<Mufhas>(mufhases[selected.mufhasId]);
export const selectedSurah = atom<Surah>(surahs[selected.surahNumber]);

export const ayatRange = atom<[number, number]>([1, 7]);

activeTrack.listen((newTrack) => {
  const activeAyatNumber = parseSurahAyatFromTrack(activeTrack.value).ayat;
  const selectedPage = mufhasSurahAyatPage[selectedMufhas.value.id][selectedSurah.value.id][activeAyatNumber];
  activePageNumber.set(selectedPage);
  console.log({selectedPage, activePageNumber: activePageNumber.value});
});

selectedSurah.listen((newSurah) => {
  ayatRange.set([1, newSurah.totalVerses]);
});

activeTrack.listen((newTrack) => {
  const activeAyatNumber = parseSurahAyatFromTrack(activeTrack.value).ayat;
  document.title = `${selectedSurah.value.id}:${activeAyatNumber} : ${selectedSurah.value.transliteration} - ${appName}`;
});