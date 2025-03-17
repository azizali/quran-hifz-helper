import { useStore } from "@nanostores/react";
import React, { useEffect, useMemo } from "react";
import {
  activePageNumber as activePageNumberStore,
  activeTrack,
  isAudioSyncedWithPage,
  selectedMufhas,
} from "../_main/sharedState";
import { mufhasSurahAyatPage } from "../_main/surahAyatToPage";
import { parseSurahAyatFromTrack } from "../_main/utils";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "./ui/carousel";

const Page: React.FC = () => {
  const $activeTrack = useStore(activeTrack);
  const { surah, ayat } = parseSurahAyatFromTrack($activeTrack);

  const $selectedMufhas = useStore(selectedMufhas);
  const $isAudioSyncedWithPage = useStore(isAudioSyncedWithPage);
  const $activePageNumber = useStore(activePageNumberStore);
  const lastPageNumber = $selectedMufhas.totalPages;

  const [api, setApi] = React.useState<CarouselApi>()
  const activePageNumber = useMemo(() => {
    if ($isAudioSyncedWithPage) {
      return mufhasSurahAyatPage[$selectedMufhas.id][surah]?.[ayat] || 1;
    }
    return $activePageNumber;
  }, [$isAudioSyncedWithPage, $activePageNumber]);

  const handleNavigate = (pageNumber: number) => {
    isAudioSyncedWithPage.set(false);
    activePageNumberStore.set(pageNumber);
  };

  const handleCarouselChange = (newPageNumber:any) => {
    console.log({newPageNumber})
    handleNavigate(newPageNumber);
  };

  useEffect(() => {
    if (!api) {
      return
    }

    activePageNumberStore.set(api.selectedScrollSnap() + 1)

    api.on("select", () => {
      activePageNumberStore.set(api.selectedScrollSnap() + 1)
    })
  }, [api])

  return (
    <>
      activePageNumber: {$activePageNumber}
      <Carousel setApi={setApi}>
        <CarouselContent>
          {Array.from({ length: lastPageNumber }, (_, i) => i + 1).map((pageNumber) => (
            <CarouselItem key={pageNumber}>
              <img
                src={`${$selectedMufhas.urlPath}/${pageNumber}.png`}
                alt={`Page number: ${pageNumber}`}
                className="h-full"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselNext />
        <CarouselPrevious />
      </Carousel>
    </>
  );
};

export default Page;
