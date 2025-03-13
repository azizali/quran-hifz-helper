import MufhasSelection from "./MufhasSelection";
import SurahSelection from "./SurahSelection";

const Menu = () => {
  return (
    <div className="flex justify-between">
      <SurahSelection />
      <MufhasSelection />
    </div>
  );
};

export default Menu;
