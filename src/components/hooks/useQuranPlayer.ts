import { isNativePlatform } from "../../_main/platform";
import useNativeQuranPlayer from "./useNativeQuranPlayer";
import useWebQuranPlayer from "./useWebQuranPlayer";

const useQuranPlayer = isNativePlatform() ? useNativeQuranPlayer : useWebQuranPlayer;

export default useQuranPlayer;
