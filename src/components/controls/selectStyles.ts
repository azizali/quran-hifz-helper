/**
 * One quiet look for every dropdown on the player (Qari, Surah, From, To):
 * no box, just the value and a chevron, with a faint fill on hover.
 * 16px text also stops iOS from zooming the page when a select is focused.
 */
export const selectClass =
  "h-11 w-full min-w-0 appearance-none truncate rounded-lg bg-transparent pl-3 pr-8 text-base font-semibold tabular-nums text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:text-slate-400";

export const selectChevronClass = "pointer-events-none absolute right-2.5 text-slate-400";
