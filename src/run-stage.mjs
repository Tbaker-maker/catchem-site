// Run stage comes from the data (signal-chips.json, written nightly by the
// seller-stage rule in Catchem-data), never from a formula on the site. The
// site, the email and the bot all read the same tile, in the same order:
// the listings tile first, then the price tile.
export const STAGE_WORDS = ["Building", "Slowing", "Stalled", "Reversing"];

function ok(st) {
  return st && typeof st === "object" && STAGE_WORDS.includes(st.word) && Number(st.days) > 0 ? st : null;
}

export function stageFromChips(chips, sku) {
  const id = chips?.bySku?.[sku];
  const row = id ? chips?.byId?.[id] : null;
  const tiles = row?.tiles;
  if (!tiles || typeof tiles !== "object") return null;
  const st = ok(tiles.listings?.stage) || ok(tiles.price?.stage);
  return st ? { word: st.word, dir: st.dir === "down" ? "down" : "up", days: Math.round(Number(st.days)), date: String(st.date || "") } : null;
}

// Same wording as the card tile.
export function stageLine(st) {
  if (!st) return "";
  const n = st.days;
  const d = st.dir === "down" ? "down" : "up";
  const other = d === "down" ? "up" : "down";
  let line;
  if (st.word === "Building") line = `price has ${d === "down" ? "fallen" : "climbed"} over the last ${n} days`;
  else if (st.word === "Slowing") line = `price is still moving ${d}, but more slowly than the ${n} days before`;
  else if (st.word === "Stalled") line = `price went flat after moving ${d} over the ${n} days before`;
  else line = `price turned ${d} after moving ${other} over the ${n} days before`;
  return `${st.word}: ${line}.`;
}
