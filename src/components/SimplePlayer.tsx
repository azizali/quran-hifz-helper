import { useStore } from "@nanostores/react";
import { selectedReciter } from "../_main/sharedState";

const SimplePlayer = () => {
  const $selectedReciter = useStore(selectedReciter);

  return <div>{$selectedReciter.name}</div>;
};

export default SimplePlayer;
