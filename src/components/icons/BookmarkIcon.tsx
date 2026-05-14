import * as React from "react";

const BookmarkIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    {...props}
  >
    <path
      d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-7-4-7 4V4Z"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      fill="white"
    />
  </svg>
);

export default BookmarkIcon;
