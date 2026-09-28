-- Cloudflare D1 schema for votes and community price reports.
-- Not applied in production until a D1 binding named CROWD is on the worker.
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  read_id TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
  device TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  day TEXT NOT NULL,
  condition TEXT NOT NULL,
  place TEXT NOT NULL,
  device TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS votes_read ON votes(read_id);
CREATE INDEX IF NOT EXISTS reports_product ON reports(product_id);
