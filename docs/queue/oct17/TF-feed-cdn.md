# P-1017-TF7 · Read public data from a no-history branch

**PASTE INTO: TF (site)**

```
FOR: TF (site) · P-1017-TF7 · Oct 17 2026

NOTE: ignore if already received.

Start from latest main of catchem-site, first check what is already merged and skip done work.

DO NOT TOUCH: page layout, copy, styles, the sign-in gate, Stripe, the Discord bot, or any Catchem-data workflow.

WHY: Catchem-data grows about 20 MB a night (packed) because the nightly rewrites research/assets/public/ (feed/items about 2.7 MB, plus sets and buckets) into main's history. Measured Oct 8 to 15: 743 MB of new objects in 7 days (about 480 MB of that is one-time card images), and the repo is at about 943 MB. The site reads every public file from raw.githubusercontent.com/.../main/, so the data side cannot stop committing them until the site can read from somewhere else.

MAIN JOB (one job, sized to finish in one usage window): Make every data URL in src/data.mjs (BASE, DIVE_BASE, CATALOGUE_ROOT and any other raw.githubusercontent.com/.../main/ URL in src/) come from one config function. It reads from the Catchem-data branch public-data first, then falls back to main on a 404 or network error, for each file. RD will force-push public-data nightly as a single commit with no history, so the files keep the same paths. Keep the fallback until RD confirms public-data is live for 7 nights. Cache which base worked for the session so a missing branch costs at most one extra request. No new hosts, no new paid services.

RULES: no new costs, no extra API calls, keep page load the same or faster. Minimize human steps. User-facing copy: no em dashes; no buy, sell, hold, support, resistance, bottom, printed, play, target, invest, stack, load up or crypto words.

KEEP GOING: when this merges, report, then wait for the RD prompt that starts publishing public-data and stops committing feed/items, sets and buckets to main.

BONUS (only if usage is left): Add a test that a 404 on public-data falls back to main and the second file in the same session goes straight to the base that worked, plus a test that no raw main URL is hardcoded outside the config function. Merge each finished piece as its own small green PR.

DONE MEANS: every data fetch goes through the config function, public-data is tried first, main is the fallback, tests pass, CI green, merged, and the live site still loads /, /sets, a /c/ page and a /p/ page with no console errors at 390 and 1280.

REPORT in ONE fenced block that starts with the ID:

P-1017-TF7 | PR # | CI status | final SHA | what shipped | what is left
```
