import * as React from "react";

const PlaylistIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    {...props}
  >
    <rect x="3" y="6" width="13" height="2" rx="1" fill="currentColor" />
    <rect x="3" y="11" width="13" height="2" rx="1" fill="currentColor" />
    <rect x="3" y="16" width="9" height="2" rx="1" fill="currentColor" />
    <circle cx="19" cy="17" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M21 17v-4l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default PlaylistIcon;
