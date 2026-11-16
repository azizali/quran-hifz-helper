import type { SVGProps } from "react";

type CloudIconProps = SVGProps<SVGSVGElement> & { checked?: boolean };

/** Offline status: a cloud, with a check once everything is saved. */
const CloudIcon = ({ checked = false, ...props }: CloudIconProps) => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M7 18h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.3 4.5 4.5 0 0 0 7 18z" />
    {checked && <path d="M9.5 13.5l2 2 3.5-3.8" />}
  </svg>
);

export default CloudIcon;
