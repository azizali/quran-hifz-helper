import MufhasSelection from "./MufhasSelection";
import SurahSelection from "./SurahSelection";

const Menu = () => {
  return (
    <div className="text-xs flex justify-between p-1 gap-1">
      <SurahSelection />
      <MufhasSelection />
    </div>
  );
};

export default Menu;
