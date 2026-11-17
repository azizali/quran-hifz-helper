import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const ChevronLeftIcon = (props: IconProps) => (
  <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" {...stroke} strokeWidth={2} {...props}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

/** A side panel with an arrow pointing out: "show the controls". */
export const PanelOpenIcon = (props: IconProps) => (
  <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" {...stroke} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M13 10l2 2-2 2" />
  </svg>
);

export const PlayIcon = (props: IconProps) => (
  <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
  </svg>
);

export const PauseIcon = (props: IconProps) => (
  <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" />
    <rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" />
  </svg>
);

export const RestartIcon = (props: IconProps) => (
  <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" {...stroke} {...props}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" />
    <path d="M3.5 3.5v5h5" />
  </svg>
);

export const LoopIcon = (props: IconProps) => (
  <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" {...stroke} strokeWidth={2} {...props}>
    <path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3" />
  </svg>
);

/** Text style: a large and a small letter, for the Quran text settings. */
export const TextStyleIcon = (props: IconProps) => (
  <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" {...stroke} {...props}>
    <path d="M3 18L8.5 5h1L15 18M5.2 13.5h7.6" />
    <path d="M17 11.5a2.5 2.5 0 015 0V18M22 15.2c-.9-.5-1.7-.7-2.5-.7-1.6 0-2.5.8-2.5 1.9s.9 1.8 2 1.8c1.3 0 2.4-.9 3-2" />
  </svg>
);
