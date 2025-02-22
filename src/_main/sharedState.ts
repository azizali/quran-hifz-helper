import { atom } from "nanostores";
import { type Track } from "./types";

export const activeTrack = atom<Track>("001001" as Track);
