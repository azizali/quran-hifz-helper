import { useStore } from "@nanostores/react";
import React, { useMemo } from "react";
import {
  activePageNumber as activePageNumberStore,
  activeTrack,
  isAudioSyncedWithPage,
  selectedMufhas,
} from "../_main/sharedState";
import { surahAyatToPage } from "../_main/surahAyatToPage";
import { parseSurahAyatFromTrack } from "../_main/utils";

const Page: React.FC = () => {
  const $activeTrack = useStore(activeTrack);
  const { surah, ayat } = parseSurahAyatFromTrack($activeTrack);

  const $selectedMufhas = useStore(selectedMufhas);
  const $isAudioSyncedWithPage = useStore(isAudioSyncedWithPage);
  const $activePageNumber = useStore(activePageNumberStore);
  const lastPageNumber = 612;

  const activePageNumber = useMemo(() => {
    if ($isAudioSyncedWithPage) {
      return surahAyatToPage[surah]?.[ayat] || 1;
    }
    return $activePageNumber;
  }, [$isAudioSyncedWithPage, $activePageNumber]);

  const handleNavigate = (pageNumber: number) => {
    isAudioSyncedWithPage.set(false);
    activePageNumberStore.set(pageNumber);
  };

  return (
    <div className="flex justify-center h-screen">
      <button
        className="btn p-3 border-2"
        onClick={() => handleNavigate(activePageNumber + 1)}
        disabled={activePageNumber > lastPageNumber - 1}
      >
        &lt;
      </button>
      <img
        src={`${$selectedMufhas}/${activePageNumber}.png`}
        alt={`Page number: ${activePageNumber}`}
        className="h-full"
      />
      <button
        className="btn p-3 border-2"
        onClick={() => handleNavigate(activePageNumber - 1)}
        disabled={activePageNumber < 1}
      >
        &gt;
      </button>
    </div>
  );
};

export default Page;
