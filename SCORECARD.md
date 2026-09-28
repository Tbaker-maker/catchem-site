# Post Office scorecard

Measured on the live site 2026-09-28 after [catchem-site#19](https://github.com/Tbaker-maker/catchem-site/pull/19) and [catchem-site#20](https://github.com/Tbaker-maker/catchem-site/pull/20). Browser numbers are from headless Chromium at 390×844 and 1280×800, cache disabled. Two passes: the first found a broken compare; the second was after the fix.

[catchem-app#14](https://github.com/Tbaker-maker/catchem-app/pull/14) and [catchem-data-private#1](https://github.com/Tbaker-maker/catchem-data-private/pull/1) are still open. They were not merged.

## Homepage and chrome

| Check | 390 | 1280 |
|---|---|---|
| H1 | A home for collectors, rippers and flippers. | same |
| document.title | Catch'em — a home for collectors, rippers and flippers. | same |
| og:title | Catch'em — a home for collectors, rippers and flippers. | same |
| og:image:alt | Catch'em. A home for collectors, rippers and flippers. | same |
| #site-nav display | none, rect 0×0, not visible | flex, visible (home 458×44) |
| nav.dock display | flex, rect 390×57, visible | none, rect 0×0 |
| Menu button | visible | display none |

"Know what to rip" is not in the homepage HTML, the Post Office HTML, or og.png (37512 bytes). The image headline is "A home for collectors, rippers and flippers." "Opening soon", "catalogue", "sells for", and "about 0" are absent from both pages.

## Routes

| Request | Result |
|---|---|
| GET /build | 301 to https://catchemtcg.com/post-office. Final URL after the browser redirect is that page. |
| HEAD /build | 301 to the same URL (this was a cached 200 until #20). |
| GET /post-office | 200. Locked line: "The full catalog: every card and every artist. Pick one and the post is ready for X or Facebook." |
| GET /data/counts.json | items 30428, asOf 2026-09-27, single 27430, sealed 2998 |
| GET /video/studio.html | 404 |
| GET /video/studio.html?video=1 | 404. The query string does not turn Shorts on. |
| GET /feed | 200. "Make a Short" is absent while the server flag is off. |
| GET /api/card-img?pid=246723 | 200 image/jpeg, 37249 bytes |

## Editor

Catalog line before any search: "30,428 catalog rows loaded. Pocket 3,879."

| Query | First card | Price line |
|---|---|---|
| Umbreon VMAX 215 | Umbreon VMAX (Alternate Art Secret), 215/203, Evolving Skies, Secret Rare | TCGplayer market: $2,214.79 (2026-09-27) |
| Charizard 151 SIR | Charizard ex - 199/165, Special Illustration Rare | TCGplayer market: $346.31 (2026-09-27) |
| Pikachu ex (Pocket mode) | Pikachu ex, Genetic Apex, Crown · 285 | No market price |
| Pikachu Star Holon (ranker) | tcgcsv-88111, Pikachu Star, EX Holon Phantoms, 104/110 | 900 |
| Shining Tyranitar (ranker) | tcgcsv-89171, Neo Destiny, 113/105 | 345 |

Those last two are the catalog rows, not the old paper prices ($3,200 and $4,249.99).

"Pikachu, both" at both widths: 2 articles in #stage, not one card. Meta: "TCG and Pocket, side by side. Not one paper card." TCG card was Pikachu with Grey Felt Hat, promo 085, TCGplayer market: $1,048.43 (2026-09-27). Pocket card was Pikachu, Genetic Apex, One Diamond · 094, no market price. No page error on the second pass.

The first pass clicked the chip and got 0 cards because `printingRank is not defined`. That is fixed in #20. The second pass had no page errors.

Artist "Mitsuhiro Arita": 12 cards. Meta: "12 notable prints. Highest price first. Commons under $20 stay off this list when a higher print exists." First three: Gengar ex $1,399.99, Charizard $944.53, Mewtwo GX (Secret Shining) $819.25. All dated 2026-09-27. The first is not a common under $20. The auditor counted 498 priced rows for that artist, 368 of them under $20, and those were not the default list.

Download names are built as a single `.png` (`downloadName` is in the page; `catchem-post.png.jpg` normalizes to `catchem-post.png` in the unit test).

## Ideas and post text

Anonymous POST `{}`:

| Route | Status | Card |
|---|---|---|
| /api/ideas | 401 | Sign in for Ideas. Free 3 a day, Premium 50. |
| /api/post-text | 401 | Sign in for post text. Free 3 a day, Premium 100. |
| /api/video/quota | 401 | Sign in to export. Free 1 a day and 2 a week. Premium 5 a day and 35 a week. |

None of those returned 405. A signed session is required. There is no sign-in form yet, so the buttons show the limit card and do not call a model from the browser. No API key is in the page. With a server key, post text uses `grok-4.20-0309-non-reasoning` and a catalog fact pack; without the key the response is the fact pack.

## Shorts sample (not deployed)

The sample on the unmerged Shorts branch was measured with ffmpeg, not a phone:

- File `public/video/samples/hook-1080.mp4`
- h264 Constrained Baseline (avc1), aac, 1080×1920, 24 fps, duration 6.00s
- Card box from `cardFrame(1080, 1920)`: x 114, y 96, 852×1190, which is 1190/1920 = 0.6198 of the frame height
- Hook frame includes the card. The price line sits above the caption pill (price at y 1688, pill at y 1780)

Studio export asks for `video/mp4;codecs=avc1.42E01E,mp4a.40.2` and will not name a VP9 recording `.mp4`. Card art in the studio is `/api/card-img`, not `/cards/cache/`.
