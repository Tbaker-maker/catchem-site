# Five second test

Run: `node scripts/five-second-test.mjs`

Phone viewport 390 by 844. Live site `https://catchemtcg.com`. No signups, no paid buttons, no checkout.

This run finished 11:53 PM PT on Oct 25, 2026. Machine file: `qa/five-second-results.json`. Stills: `qa/shots/`.

Ship bar from the brief: Catch'em beats each rival on taps and time for 5 tasks. Wander on `/explore` averages 6 or more items and 0 dead ends. Accessibility checks all pass.

Result: do not ship. Two screens pass the script gate. The wander averaged 2.7 items and hit a dead end in every session.

Open PRs were not edited. This branch only adds `scripts/five-second-test.mjs` and `qa/`.

## How the test repeats

1. Open the screen at 390. Do not scroll. Read for 5 seconds.
2. Three questions, scored 0, 1, or 2 by a beginner, a regular collector, and a returning reader.
   - What is this screen for?
   - What do I tap next?
   - Where is the receipt (product, price or count, date, source)?
3. A price screen passes only when the beginner scores 2 on the first question and 2 on the receipt.
4. The script also checks overflow, a plain price in the first screen, 44px targets, contrast, names, and color used as the only up or down signal.
5. Wander: start at `/explore`, 3 minutes, three personas. Count product, sealed, and set pages opened. A dead end is a 404 or a tap that does not change the page.
6. Rival tasks start at each site's home. Taps are clicks. Typing is not a tap. Time includes typing.

## Scorecard

| Screen | First screen | Beginner | Script | Verdict |
|---|---|---|---|---|
| Home v2 `/` | H1: Know what every card and pack is doing. A latest read names Heat Rotom, two prices, two dates, and TCGplayer market. | 2 / 2 / 2 | Pass | Pass |
| Pulse `/pulse` | Redirects to The Feed. Lead card: Crown Zenith Special Collection, Up 247.2%, $290.50. Source is not in the first screen. The word Pulse is not on the page. | 2 / 1 / 1 | Pass | Partial. The card is clear. The page name and the source are not. |
| Tab bar | Feed, Sets, Search, Indexes, Premium. Each tab is 72 by 48. | 1 / 2 / 2 | Fail | Fail. Indexes is not a word a new reader knows. |
| Product v2 `/c/tcgcsv-517045` | Charizard ex 199/165. Store buttons, then Price being checked. No market price. | 1 / 0 / 0 | Fail | Fail |
| Product, sealed `/p/tcgcsv-503313` | 151 Elite Trainer Box. First price line is PRICE 7D Flat from $496.87, Oct 16. | 2 / 1 / 0 | Fail | Fail. A price is there. The sentence is not plain, and the count is below the fold. |
| Receipt sheet | Same sealed page. No sheet. The numbers is not in the first screen. listings counted is lower on the page, not in the 5 second view. | 0 / 0 / 0 | Fail | Fail |
| Explorer `/explore` | 404. Heading: This page is not here. Search, Home, All sets, Releases. | 2 on the error, 0 on the job | Fail | Fail |

Stills: `qa/shots/home-v2-390.png`, `pulse-390.png`, `tab-bar-390.png`, `product-v2-390.png`, `product-sealed-390.png`, `receipt-sheet-390.png`, `explorer-390.png`.

## Wander

Start URL `/explore`. 180 seconds each. Personas did not open Premium and did not follow store links.

| Persona | Items opened | Seconds | Dead ends |
|---|---|---|---|
| Beginner | 3 | 180 | 2 |
| Regular | 2 | 180 | 2 |
| Returning | 3 | 180 | 2 |
| Average | 2.7 | 180 | 2 per session |

Dead ends, every session:

- At 0 seconds, `/explore` is a 404.
- Around 8 seconds, the Feed lead title (Crown Zenith Special Collection) did not open a new page. The session then stalled on hub tabs.

Confusion words that showed up: Momentum, 7D, Fast mode, Fear and Greed, and the store button label.

Bar was 6 or more items and 0 dead ends. Missed.

## Rival tasks

Same five jobs. Phone width. No accounts.

TCGplayer at 390 did not expose a search field the script could tap (0 inputs on that home). Those cells are not a win for anyone. They are unmeasured.

PriceCharting's home matched a loose "prices plus a year" rule at 0 taps. That home is not a Pokémon read, so it is not counted as the market-read task.

| Task | Catch'em | PriceCharting | PokeData | TCGplayer |
|---|---|---|---|---|
| Card price, Charizard ex 199/165 | Fail. 2 taps, 3.5s. Page says Price being checked. | Pass. 2 taps, 2.7s. | Not completed. An app dialog covered the box. | Unmeasured |
| Date on that price | Fail. 2 taps, 3.5s. | Pass. 2 taps, 2.5s. | Pass. 2 taps, 3.2s. | Unmeasured |
| Listings counted for that card | Fail. 2 taps, 3.5s. Those words are not on the card. | Fail. 2 taps, 2.6s. | Fail. 2 taps, 3.1s. | Unmeasured |
| One market read with a price and a date | Pass. 1 tap, 1.9s, via Open the Feed. The home already shows one dated read. | Not counted. See note above. | Pass. 0 taps, 1.4s. The home lists prices and a date. | Fail. No dated list on the first screen. |
| 151 Elite Trainer Box price | Pass. 3 taps, 3.4s. First screen shows $496.87 as PRICE 7D. | Pass. 2 taps, 2.6s. | Fail. 3 taps, 4.3s. | Unmeasured |

Catch'em does not beat each rival. PriceCharting is faster on the card and on the ETB. PokeData shows a dated price list with no tap. The card task is a loss because the price is withheld.

## Accessibility

Checked on the first screen of each flagged page, including the tab bar.

| Check | Result |
|---|---|
| Contrast on the dark palette | Pass on the sampled text. No line fell under 4.5 for body text or 3 for large text. Token check, not a substitute for the live sample: text `#efe9de` on `#12100e` is 15.71, soft `#c4baab` on `#12100e` is 9.91, gold `#d9b779` on `#12100e` is 9.94, red `#e0675b` on `#12100e` is 5.66. |
| Up and down without color alone | Pass on the screens we opened. The Feed says Up 247.2%. The sealed tile says Flat, and the same screen says green is up, red is down, grey is flat. |
| 44px targets | Fail. Tab bar buttons are 72 by 48 and pass. The logo is 28px tall. Skip to content is 43px tall. Set and finish links on the product are 20 to 28px tall. |
| Screen reader names | Partial. Buttons and tab labels have names. Menu says Menu. The set logo `img/sv3pt5/logo.png` has no alt on the product screens. |

## Top 10 fixes

1. Give Explorer a real page, or remove every path that can land on `/explore`. A 404 is a dead end. The planned tabs (Sets, Cards, Sealed, Reads, Calendar) are not there.
2. Put a market price, a date, and the source on Charizard ex 199/165. Price being checked cannot be the whole first screen.
3. Move store links below the price. They currently sit above the missing price, so the page looks like a shop.
4. Make the receipt the first block on a product: price, date, listings counted, source. Do not hide the count under the fold. There is no receipt sheet today.
5. Replace DATA and PRICE 7D with one plain sentence. Example shape: 151 Elite Trainer Box, TCGplayer market, price, date.
6. Rename or drop Indexes on the tab bar. Feed, Sets, and Search are enough for a new reader.
7. Show the source on the Feed card in the first screen, and decide whether the page is called Feed or Pulse. Both names are in play. Only Feed is on the screen.
8. Make the Feed lead title open the product. In all three wanders that tap did nothing.
9. Raise the logo and the small set links to 44px. Give the set logo an alt name.
10. Keep Momentum, Fast mode, and Fear and Greed off the first phone screen until each one has a plain label a beginner can say back.

## What this does not change

No site render code. No open PR files. No Stripe, no email, no paid signup. The script is the thing to rerun before a later ship.
