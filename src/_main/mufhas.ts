// TODO change stings to branded types
export type MufhasId = string;

export type Mufhas = {
  id: MufhasId;
  name: string;
  urlPath: string;
  totalPages: number; // TODO type so that its 3 to 200
};

type Mufhases = {
  [key: MufhasId]: Mufhas;
};

const mufhases: Mufhases = {
  fifteenLine: {
    id: "fifteenLine",
    name: "15 line Urdu (InfoPak)",
    urlPath: "15-line-simple",
    totalPages: 611,
  },
  // uthmani: {
  //   id: "uthmani",
  //   name: "Uthmani",
  //   urlPath: "uthmani",
  //   totalPages: 604,
  // },
};

export default mufhases;
