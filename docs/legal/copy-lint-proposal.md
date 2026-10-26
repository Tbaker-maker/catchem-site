# CI copy lint proposal

Add a check that fails the build if public copy (index.html, src/ui.mjs strings, newsletter) contains banned advice or competitor words.

## Lint rule list

Block these strings in public pages and share cards (case insensitive):

- advice
- recommend
- should buy
- investment
- return
- profit
- guaranteed
- bullish
- Collectr
- TCG Quant
- raffle
- stadium (except internal comments)

Allow and prefer:

- listings counted
- market price
- as of [date]
- source
- Paid link

Implementation sketch (do not merge yet):

scripts/copy-lint.mjs reads listed files, greps the banned list, exits 1 on hit. Wire it in .github/workflows as a required check after the existing tests. Skip any file owned by an open PR until that PR merges.

No em or en dashes in the lint messages.
