import * as React from "react";

const BinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    {...props}
  >
    <path
      d="M6.5 8.5v5m3-5v5m3-5v5M3 5.5h14M8.5 3.5h3A1.5 1.5 0 0 1 13 5v0H7v0a1.5 1.5 0 0 1 1.5-1.5ZM5 5.5v10A1.5 1.5 0 0 0 6.5 17h7A1.5 1.5 0 0 0 15 15.5v-10"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default BinIcon;
