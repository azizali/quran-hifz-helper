import { registerPlugin } from "@capacitor/core";
import type { NativeQuranAudioPlugin } from "./definitions";

const NativeQuranAudio = registerPlugin<NativeQuranAudioPlugin>("NativeQuranAudio");

export * from "./definitions";
export { NativeQuranAudio };
