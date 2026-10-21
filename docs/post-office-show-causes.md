# Post Office Show pathways: root causes

Written 2026-10-20. Do not treat this as a fix. The desk stays closed until a rebuild.

The Show row lives in the editor (`research/assets/play.html` in Catchem-data, served at `/post-office/app`). `paintPrompts` draws the buttons. `list()` decides the rows. `screenRows` then keeps cards that already have a price and a picture, sorts those by price, and shows 40. `tcgImg` rewrites a `/img/{set}/{number}` src to `images.pokemontcg.io/{set}/{number}_hires.png`.

- All: prompt `all` is not the set. `screenRows` drops every card with no price or no src and sorts the rest by price, 40 at a time. All 161 rows of 30th Celebration in `cards/full/index.json` have an empty src, so they never lead. The three bird files that do have a src are the wrong scans.
- Compare: prompt `vs` keeps one card per species, chosen by rank, then `screenRows` price-sorts that list and cuts it at 40. It is not the two prints on the desk.
- IR / SIR first: prompt `top` keeps every card that is not Common, Uncommon, or Rare, and also anything tagged `connecting`, then sorts by price. Illustration Rares and Special Illustration Rares are not put first. The connecting files are included, and those files are the wrong cards.
- 30th Celebration: the button keeps rows whose tags contain `30th`. The real 161-card set has empty tags and an empty src, so it is skipped. The button shows the three hardcoded ids in `BIRD_IR`. The file for the Moltres id is an Italian Zapdos.
- Connecting art: `applyPrompt` pins `c30-ir-moltres`, `c30-ir-articuno`, and `c30-ir-zapdos` and ignores the catalogue. `ir-moltres.png` is Italian Zapdos 133/128, set stamp 30CIT. `ir-articuno.png` is French Artikodin 132/128, set stamp 30CFR. `ir-zapdos.png` is the English regular Zapdos 055/128, not the illustration rare.
- Gold Star: the button value is `star`. `list()` treats `star` as the pairing story "Star vs now" (`pairStory`), which returns nothing unless a Pokémon is already picked, and `applyPrompt` also clears the set. It does not list the Gold Star cards.
- SIR: the lane matches rarity `Special Illustration Rare`, then `screenRows` drops the 10 30th Celebration SIRs because their src is empty. Every other src goes through `tcgImg`. Catch'em ids such as `rsv10pt5`, `zsv10pt5`, and `me55` are not set ids on images.pokemontcg.io, so those pictures 404 and the image is hidden.
- Futuristic: only Mewtwo ex (`me55-157`) and Mew ex (`me55-158`) have rarity `Futuristic Rare`, and both have an empty src. The lane is two holes. `srcOf` then looks for `/cards/seed/me55-157.png`, which is not that card.
- BWR: only Reshiram ex and Zekrom ex match `Black White Rare`. Their src values are `/img/rsv10pt5/173` and `/img/zsv10pt5/172`. `tcgImg` sends those to images.pokemontcg.io, which has no `rsv10pt5` or `zsv10pt5` set, so both pictures 404.

Wrong image: the slot named Moltres is hardcoded to `/cards/c30/ir-moltres.png`. That file is not Moltres. It is the Italian Zapdos illustration rare, number 133/128, set stamp 30CIT, printed name Zapdos. The filename was taken from the English species. Nothing checked the printed name or the language stamp before the file was saved.

French card: `ir-articuno.png` is the French Articuno, printed name Artikodin, number 132/128, set stamp 30CFR, saved under the English filename. `paperOk` only drops `lang === "jp"`, and this file has no lang field, so the English desk treats it as English. The French name is not a catalogue row. `cards/full/index.json` has zero French names (Artikodin, Sulfura, Dracaufeu). The French card got in as a picture file on the pinned English id, not through the set list.
