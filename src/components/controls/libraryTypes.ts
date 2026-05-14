export type SelectionRange = [number, number];

export type Bookmark = {
  id: string;
  label: string;
  surahNumber: number;
  ayatRange: SelectionRange;
  createdAt: number;
};
