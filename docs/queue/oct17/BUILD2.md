# P-1017-BUILD2 · TF builder

**PASTE INTO: TF (site)**

FOR: TF (site) · P-1017-BUILD2 · Oct 17 2026

NOTE: ignore if already received and finished. If you already started, this same prompt resumes.

Start from latest main of catchem-site. Read docs/BUILD2-progress.md (create it if missing, one line per queue item: ID, status TODO, SHIPPED or BLOCKED, PR number, SHA, note). Check what is already merged and skip every SHIPPED item.

DON'T TOUCH: Catchem-data, catchem-bot, .github/workflows files (write the exact lines into the PR body and mark that part BLOCKED), Stripe and Premium internals, auth logic.

YOU ARE A BUILDER. Ship working features to main, not plans, audits or questions. Every turn ends with merged code. Never reply with only a summary. Never wait for approval.

MAIN JOB (one job: ship this chat's queue, one item at a time, in this order):

1. P-1017-PO2 · Post Office buttons: Every Post Office button path works for a normal visitor on phone and desktop. Full spec: docs/queue/oct17/P-1017-PO2.md

2. P-1017-TF2 · Browse Sets redesign: Redesign Browse Sets. Full spec: docs/queue/oct17/P-1017-TF2.md

3. P-1017-TF1 · Custom reads picker: Build the Custom Reads picker page. Full spec: docs/queue/oct17/P-1017-TF1.md

4. P-1017-RD15 (site part) · Repo growth fix: change the item loader to read the nightly feed-items release asset with a fallback to the last good copy. Only once RD has published the asset; if not, mark BLOCKED and keep going. Full spec: docs/queue/oct17/P-1017-RD15.md (copied into this repo).

METHOD for each item: build it small with tests, open a PR, merge it when CI is green, then mark it SHIPPED in docs/BUILD2-progress.md with the PR number and merge SHA, and move on to the next item without asking. If an item is blocked (secrets, a workflow edit or a human step), build everything else in it, merge that, mark the rest BLOCKED with the exact thing needed, and keep going. If you stop for a usage limit, the progress file is the save point; pasting this same prompt again resumes at the first item not SHIPPED.

RULES: every number comes from a dated file. No sealed data on card pages. Empty sections hide, never show No data. Never scrape against a site's terms or get past bot blocks. Never use Collectr prices. No buying or checkout bot. Minimize costs and human steps, maximize automation, learn over time. NM is a single-card condition only, never on sealed. User-facing copy: no em dashes; no buy, sell, hold, support, resistance, bottom, printed, play, target, invest, stack, load up or crypto words; say listings counted, never supply alone; listings that disappear are listings gone, never sales; no creator names.

KEEP GOING: after each merge, update the progress file and start the next item in the same turn. Never wait for a reply or approval between items. Stop only when every item is SHIPPED or BLOCKED.

BONUS (only if usage is left after the queue): add a small test that docs/BUILD2-progress.md lists every queue ID once with a valid status, and fix any flaky tests you met on the way. Merge each finished piece as its own small green PR.

DONE MEANS: every queue item is SHIPPED or BLOCKED with a reason in docs/BUILD2-progress.md, every SHIPPED item has a merged green PR and SHA, main is green.

REPORT in ONE fenced block that starts with the ID:

P-1017-BUILD2 | final SHA | then one line per item: ID | SHIPPED or BLOCKED | PR # | SHA | note
