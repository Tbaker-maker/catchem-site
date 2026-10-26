# Site strategy legal checklist

Checked 2026-10-25. Research only, not legal advice. A BC lawyer must confirm before any live money or public claim that depends on these sources.

Open PRs left alone: #322 (feature/sealed-cutouts), #61 (post-office-line-ideas).

## Source by source

| Source | Terms link | robots | Status | Notes |
|--------|------------|--------|--------|-------|
| eBay Browse API (official) | https://developer.ebay.com/join/api-license-agreement | https://pages.ebay.com/robots.txt (site scrape banned; API is the allowed path) | lawyer needed | Official API only. Asking prices, not sold. No eBay payloads in AI prompts or public JSON. Affiliate link rules apply. Written confirmation of commercial display still recommended. |
| TCGplayer / TCGCSV | https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions and https://tcgcsv.com/faq | https://www.tcgplayer.com/robots.txt (scrape banned in ToS) | lawyer needed | TCGCSV is a public cache of TCGplayer API. Attribution required on site. Direct scrape of TCGplayer pages is blocked. Confirm TCGCSV commercial display is still allowed. |
| PokemonPriceTracker | https://www.pokemonpricetracker.com/licensing | not found this pass | lawyer needed | Any revenue needs their Business plan. Redistribution banned. Written licence answer required before public use. |
| PriceCharting | https://www.pricecharting.com/page/terms-of-service and https://www.pricecharting.com/api-documentation | not checked | blocked for public | Internal use only without written commercial licence. Do not display or redistribute. |
| pokemontcg.io | https://dev.pokemontcg.io/terms | https://pokemontcg.io/robots.txt | allowed (images / catalogue) with limits | Deprecated, keys until 2027-03-01. Rate limits apply. No heavy automated burden. Prefer Scrydex long term. |
| Scrydex | https://scrydex.com/terms | not checked | lawyer needed | Successor to pokemontcg.io. Confirm commercial image and price use on current plan before relying on it. |
| Cloudflare analytics | https://www.cloudflare.com/privacypolicy/ | n/a | allowed | Disclose in Privacy Policy. |
| Stripe | https://stripe.com/legal/restricted-businesses | n/a | lawyer needed | Prize promotions / giveaways may need review. Raffles and Stadium stay off until cleared. |

## Attribution wording for mirrored history

Proposed public line (no advice words):

"Pulse history is mirrored third-party data until Catch'em has a full year of its own. Each point shows the source and the date we read it. Listings counted, not sold."

Do not name creators. Do not name Collectr or any competitor.

## Correction policy (news grades and read ledger)

Under 100 words:

News grades and the public read ledger show the source, the date, and what we said. If a grade or read is wrong we mark it, say why, and keep the original line so the miss stays visible. Corrections appear on the same page within one day of confirmation. We do not delete misses. Email support@catchemtcg.com with the page and the date. We do not promise any result from a read.

## Confirmations

- No competitor text, layout, scores, or data is used in proposed public copy. Checked against open PRs and current site language. Status: clean in this branch. Flag any future pull of Collectr, TCG Quant, or similar.
- Raffles and Stadium stay off. Do not ship entry, odds, or prize language until official rules and a lawyer review exist. Homepage currently mentions "Watch the Stadium live" in one place; that must be removed or hidden before launch.

## Advice auditor

Proposed public copy uses none of: advice, recommend, should buy, investment, return, profit, guaranteed, bullish, heat as a signal. Allowed: listings counted, market price, date, source, up or down with numbers.

## Privacy reviewer notes

Watchlist and device storage stay local unless the user signs in. Sign-in uses Discord. Newsletter emails need consent and an unsubscribe. Deletion requests go to support@catchemtcg.com.
