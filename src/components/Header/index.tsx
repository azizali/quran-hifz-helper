import type { ReactNode } from "react";
import CacheClearButton from "../controls/CacheClearButton";

interface HeaderProps {
  appName: string;
  rightActions?: ReactNode;
}

const Header = ({ appName, rightActions }: HeaderProps) => {
  return (
    <div className="flex justify-between items-center bg-primary text-white p-2">
      <h1 className="text-2xl">{appName}</h1>
      <div className="shrink-0 flex items-center gap-2">
        {rightActions}
        <CacheClearButton />
      </div>
    </div>
  );
};

export default Header;
