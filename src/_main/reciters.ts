// TODO change stings to branded types
export type ReciterKey = string;

export type Reciter = {
  id: ReciterKey;
  name: string;
  urlPath: string;
};

type Reciters = {
  [key: ReciterKey]: Reciter;
};

const reciters: Reciters = {
  // TODO: Adding receiters stops audio after 2 seconds or hangs the app
  mishary: { id: "mishary", name: "Mishary", urlPath: "Alafasy_128kbps" },
  hudhaify: { id: "hudhaify", name: "Hudhaify", urlPath: "Hudhaify_128kbps" },
  husary: { id: "husary", name: "Husary", urlPath: "Husary_128kbps" },
};

export default reciters;
