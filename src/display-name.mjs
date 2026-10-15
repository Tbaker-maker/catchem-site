// Display-only card name split for set lists. Ids and data are untouched.
// "Paradise Resort - 092 (World Championships 2026)" -> title "Paradise Resort",
// num "092", variants ["World Championships 2026"].
export function splitName(name, num) {
  var s = String(name == null ? "" : name).trim();
  var variants = [];
  var found = "";
  for (var i = 0; i < 6; i++) {
    var p = s.match(/\s*\(([^()]+)\)\s*$/);
    if (p) { variants.unshift(p[1].trim()); s = s.slice(0, p.index).trim(); continue; }
    var d = s.match(/\s+-\s+([A-Za-z]{0,6}\d+[A-Za-z]?(?:\/[A-Za-z]{0,6}\d+)?)\s*$/);
    if (d) { found = found || d[1]; s = s.slice(0, d.index).trim(); continue; }
    break;
  }
  var n = String(num == null ? "" : num).trim() || found;
  variants = variants.filter(function (v) { return v && v !== n && !/^\d+[a-z]?$/i.test(v); });
  return { title: s || String(name == null ? "" : name).trim(), num: n, variants: variants };
}
