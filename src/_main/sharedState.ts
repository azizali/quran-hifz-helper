import { atom } from "nanostores";
import { type Mufhas, type Track } from "./types";

export const activeTrack = atom<Track>("001001" as Track);

export const isAudioSyncedWithPage = atom<boolean>(false);
export const selectedMufhas = atom<Mufhas>("15-line-simple");
export const activePageNumber = atom<number>(611);
