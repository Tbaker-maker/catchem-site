// Open data on a feed read lands on the item's own page, scrolled to the
// section the read is about. Reads with no item keep their read page.
// Self-contained: the function body is copied into the feed page script.
export function openDataHref(card) {
  var kind = String((card && (card.readKind || card.kind)) || "");
  var map = { listings: "supply", breadth: "supply", "rarity-band": "rank", "artist-band": "rank", set: "rank", rotation: "stats", release: "stats", "release-cycle": "stats", season: "stats", rip: "stats", sealed: "stats" };
  var section = map[kind] || "price";
  var sku = String((card && card.sku) || "");
  var href = String((card && card.href) || "");
  var hm = href.match(/^\/(c|p)\/(tcgcsv-[0-9]+)$/);
  var id = /^tcgcsv-[0-9]+$/.test(sku) ? sku : (hm ? hm[2] : "");
  if (id) return "/" + (hm ? hm[1] : (kind === "sealed" || (card && card.itemKind === "sealed") ? "p" : "c")) + "/" + id + "#" + section;
  if (/^\/(c|p)\/[a-z0-9][a-z0-9-]*$/i.test(href)) return href + "#" + section;
  if (href && href.charAt(0) === "/" && href.charAt(1) !== "/") return href;
  return card && card.id ? "/feed/r/" + encodeURIComponent(card.id) : "/feed";
}

// Section ids an item page can carry, in page order, with their jump labels.
export const ITEM_SECTIONS = [["price", "Price"], ["supply", "Listings"], ["rank", "In its set"], ["stats", "Key stats"], ["reads", "Reads"], ["related", "Related"]];
