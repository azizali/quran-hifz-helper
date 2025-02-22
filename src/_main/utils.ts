import { surahs } from "./surahs";
import type { Track } from "./types";

export function parseSurahAyatFromTrack(track: Track): {
  surah: number;
  ayat: number;
} {
  const numberStr = track.toString().padStart(6, "0");
  const surah = parseInt(numberStr.slice(0, 3), 10);
  const ayat = parseInt(numberStr.slice(3, 6), 10);
  return { surah, ayat };
}

export function genTrackFromSurahAndAyat({
  surahNumber,
  ayatNumber,
}: {
  surahNumber: number;
  ayatNumber: number;
}): Track {
  return `${surahNumber.toString().padStart(3, "0")}${ayatNumber.toString().padStart(3, "0")}` as Track;
}

export function generateAllFileNames() {
  const links: string[] = [];

  surahs.forEach(({ id: surahNumber, totalVerses }) => {
    for (let ayatNumber = 1; ayatNumber < totalVerses; ayatNumber++) {
      const track: string = `${surahNumber
        .toString()
        .padStart(3, "0")}${ayatNumber.toString().padStart(3, "0")}`;

      const link = `https://mirrors.quranicaudio.com/muqri/alafasi/opus/${track}.opus`;
      links.push(link);
    }
  });

  return links;
}
