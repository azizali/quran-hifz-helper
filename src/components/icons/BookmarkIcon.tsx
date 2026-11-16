import type { SVGProps } from "react";

type BookmarkIconProps = SVGProps<SVGSVGElement> & { filled?: boolean };

const BookmarkIcon = ({ filled = false, ...props }: BookmarkIconProps) => (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path
      d="M6 3.5h12v17l-6-4.2-6 4.2z"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </svg>
);

export default BookmarkIcon;
