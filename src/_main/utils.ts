import type { MufhasId } from "./mufhas";
import reciters, { type ReciterKey } from "./reciters";
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

  Object.keys(surahs).forEach((surahId) => {
    const { totalVerses } = surahs[parseInt(surahId)];
    for (let ayatNumber = 1; ayatNumber < totalVerses; ayatNumber++) {
      const track: string = `${surahId
        .toString()
        .padStart(3, "0")}${ayatNumber.toString().padStart(3, "0")}`;

      const link = `https://mirrors.quranicaudio.com/muqri/alafasi/opus/${track}.opus`;
      links.push(link);
    }
  });

  return links;
}

export function getAudioUrl({
  surahNumber = 1,
  ayatNumber = 1,
  reciterId = "husary",
}: {
  surahNumber?: number;
  ayatNumber?: number;
  reciterId?: ReciterKey;
}) {
  const audioSrcBaseUrl = `https://everyayah.com/data`;
  const audioExtention = "mp3"; // 'opus' | 'mp3'
  const reciterUrlPath = reciters[reciterId].urlPath;
  const track = genTrackFromSurahAndAyat({ surahNumber, ayatNumber });
  return `${audioSrcBaseUrl}/${reciterUrlPath}/${track}.${audioExtention}`;
}
