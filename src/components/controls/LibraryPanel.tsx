import { useState, type DragEvent } from "react";
import BinIcon from "../icons/BinIcon";
import type { Bookmark } from "./libraryTypes";

type LibraryPanelProps = {
  bookmarks: Bookmark[];
  loadSelection: (args: {
    surahNumber: number;
    ayatRange: [number, number];
    autoPlay?: boolean;
  }) => void;
  removeBookmark: (bookmarkId: string) => void;
  reorderBookmarks: (sourceBookmarkId: string, targetBookmarkId: string) => void;
  onClose: () => void;
};

const createDragPreview = (row: HTMLElement) => {
  const preview = row.cloneNode(true) as HTMLElement;
  preview.style.position = "absolute";
  preview.style.top = "-1000px";
  preview.style.left = "-1000px";
  preview.style.width = `${row.getBoundingClientRect().width}px`;
  preview.style.pointerEvents = "none";
  preview.style.boxSizing = "border-box";
  document.body.appendChild(preview);
  const offsetX = row.clientWidth / 2;
  const offsetY = row.clientHeight / 2;
  window.setTimeout(() => {
    document.body.removeChild(preview);
  }, 0);
  return { preview, offsetX, offsetY };
};

const getBookmarkRowClass = (isDropTarget: boolean) =>
  isDropTarget
    ? "rounded-md border-2 border-orange-400 bg-orange-50 p-2 flex items-center justify-between gap-2"
    : "rounded-md border border-slate-200 p-2 bg-white flex items-center justify-between gap-2";

const LibraryPanel = ({
  bookmarks,
  loadSelection,
  removeBookmark,
  reorderBookmarks,
  onClose,
}: LibraryPanelProps) => {
  const [draggedBookmarkId, setDraggedBookmarkId] = useState<string | null>(null);
  const [dropTargetBookmarkId, setDropTargetBookmarkId] = useState<string | null>(null);

  return (
    <section className="flex h-full flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex justify-between items-center mb-2">
          <div className="font-bold text-lg">Bookmarks</div>
          <button onClick={onClose} className="text-slate-500 text-xl px-2">×</button>
        </div>
        <div className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto pr-1">
          {bookmarks.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
              No bookmarks yet. Save your current selection for quick access.
            </div>
          )}
          {bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              data-bookmark-row
              onDragOver={(event) => {
                event.preventDefault();
                if (draggedBookmarkId && draggedBookmarkId !== bookmark.id) {
                  setDropTargetBookmarkId(bookmark.id);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedBookmarkId && draggedBookmarkId !== bookmark.id) {
                  reorderBookmarks(draggedBookmarkId, bookmark.id);
                }
                setDraggedBookmarkId(null);
                setDropTargetBookmarkId(null);
              }}
              className={getBookmarkRowClass(dropTargetBookmarkId === bookmark.id)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div
                  draggable
                  onDragStart={(event: DragEvent<HTMLDivElement>) => {
                    setDraggedBookmarkId(bookmark.id);
                    const row = event.currentTarget.closest("[data-bookmark-row]") as HTMLElement | null;
                    if (!row) return;
                    const { offsetX, offsetY } = createDragPreview(row);
                    event.dataTransfer.setDragImage(row, offsetX, offsetY);
                  }}
                  onDragEnd={() => {
                    setDraggedBookmarkId(null);
                    setDropTargetBookmarkId(null);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-slate-400 cursor-grab active:cursor-grabbing"
                  aria-hidden="true"
                  title="Drag to reorder"
                >
                  ⋮⋮
                </div>
                <div className="truncate text-sm text-slate-700">{bookmark.label}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="rounded bg-primary px-2 py-1 text-xs text-white"
                  onClick={() =>
                    loadSelection({
                      surahNumber: bookmark.surahNumber,
                      ayatRange: bookmark.ayatRange,
                      autoPlay: false,
                    })
                  }
                >
                  Select
                </button>
                <button
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 flex items-center justify-center"
                  onClick={() => removeBookmark(bookmark.id)}
                  aria-label="Delete bookmark"
                >
                  <BinIcon width={16} height={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default LibraryPanel;
