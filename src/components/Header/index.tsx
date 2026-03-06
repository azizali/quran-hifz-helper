import CacheClearButton from "../controls/CacheClearButton";

interface HeaderProps {
  appName: string;
}

const Header = ({ appName }: HeaderProps) => {
  return (
    <div className="flex justify-between items-center bg-primary text-white p-1">
      <h1 className="text-2xl">{appName}</h1>
      <div className="shrink-0">
        <CacheClearButton />
      </div>
    </div>
  );
};

export default Header;
