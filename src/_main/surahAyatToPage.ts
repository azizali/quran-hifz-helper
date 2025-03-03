import fifteenLineMufhas from "./fifteenLineMufhas";
import { type MufhasId } from "./mufhas";
import uthmaniMufhas from "./uthmaniMufhas";
export type SurahAyatToPage = {
  [surah: number]: {
    [ayat: number]: number;
  };
};

export type MufhasSurahAyatPage = {
  [mufhasId: MufhasId]: SurahAyatToPage;
};

export const mufhasSurahAyatPage: MufhasSurahAyatPage = {
  fifteenLineMufhas: fifteenLineMufhas,
  uthmani: uthmaniMufhas,
};
