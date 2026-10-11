// Client error ring. The worker keeps this in memory and, when the cache
// API exists, in the free colo cache. No new service.

const CAP = 200;

export function addError(log, event, now = new Date().toISOString()) {
  const src = log && typeof log === "object" ? log : { events: [] };
  const events = Array.isArray(src.events) ? src.events.slice() : [];
  const message = String(event?.message || "").trim().slice(0, 300);
  if (!message) return { events };
  events.push({
    message,
    source: String(event?.source || "").slice(0, 180),
    line: Number(event?.line) || 0,
    at: String(event?.at || now).slice(0, 40),
  });
  return { events: events.slice(-CAP) };
}

export function topErrors(log, n = 10) {
  const counts = new Map();
  for (const row of log?.events || []) {
    const message = String(row?.message || "").trim();
    if (!message) continue;
    const prev = counts.get(message) || { message, count: 0, last: "" };
    prev.count += 1;
    if (String(row.at || "") > prev.last) prev.last = String(row.at || "");
    counts.set(message, prev);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)).slice(0, n);
}
