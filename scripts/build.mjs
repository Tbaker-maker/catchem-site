// Assemble ./site-public for catchemtcg.com. See wrangler.jsonc.
// Node builtins + git only (Workers Builds image has both; no npm install).
import { execFileSync } from "node:child_process";
import { rmSync, cpSync, existsSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WORK = join(ROOT, ".build");
const APP = join(WORK, "catchem-app");
const OUT = join(ROOT, "site-public");
const APP_REPO = process.env.CATCHEM_APP_REPO || "https://github.com/Tbaker-maker/catchem-app.git";
const APP_REF = process.env.CATCHEM_APP_REF || "main";

rmSync(WORK, { recursive: true, force: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });
run("git", ["clone", "--depth", "1", "--branch", APP_REF, APP_REPO, APP]);
run(process.execPath, [join(APP, "scripts/build-public-site.mjs")], {
  env: { ...process.env, LANDING_FILE: join(ROOT, "index.html") },
});
cpSync(join(APP, "site-public"), OUT, { recursive: true });

// Refuse to hand wrangler a partial site: an assets deploy replaces everything.
const must = ["index.html", "build.html", "methodology.html", "corrections.html",
  "creators.html", "faq.html", "pulse.html", "board.html", "robots.txt", "sitemap.xml", "og.png", "favicon.svg"];
const missing = must.filter(f => !existsSync(join(OUT, f)));
const landers = existsSync(join(OUT, "p")) ? readdirSync(join(OUT, "p")).length : 0;
const hubs = existsSync(join(OUT, "sets")) ? readdirSync(join(OUT, "sets")).length : 0;
const root = readFileSync(join(OUT, "index.html"), "utf-8");
if (missing.length) throw new Error("site-public is missing: " + missing.join(", "));
if (landers < 150 || hubs < 40) throw new Error(`too few pages: ${landers} landers, ${hubs} set hubs`);
if (!root.includes("written so you can read them") || !root.includes('id="wl"'))
  throw new Error("root is not the waitlist page");
rmSync(WORK, { recursive: true, force: true });
console.log(`✓ catchem-site ready: ${landers} landers, ${hubs} set hubs, root = waitlist`);
