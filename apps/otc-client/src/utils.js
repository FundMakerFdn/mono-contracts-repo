export const formatPublicKey = (pubKey) => {
  return "0x" + (pubKey.parity == 27 ? "02" : "03") + pubKey.x.slice(2);
};

export const shortenText = (text, startChars = 6, endChars = 4) => {
  if (!text || text.length <= startChars + endChars) return text;
  return `${text.slice(0, startChars)}...${text.slice(-endChars)}`;
};
