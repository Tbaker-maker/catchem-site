import { pageKind, renderPath } from "../src/index.mjs";
import { bumpClick, emailLetter, emailSendAllowed, gatePlan, handleReads, planFromFields, planToFollow, preSend, renderReadsPage, sampleRead, typePlan, upsertFollow } from "../src/reads.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const typed = typePlan("Eeveelutions IRs from Scarlet and Violet, weekly");
t("a plain line becomes a weekly plan", typed && typed.frequency === "weekly" && typed.eras.includes("Scarlet and Violet") && typed.watch[0].name === "Eeveelutions IRs");
const openDaily = gatePlan(typePlan("Charizard daily"), { premium: false });
t("open access keeps a daily read", openDaily.plan.frequency === "daily" && openDaily.plan.deep === true);
const freeDaily = gatePlan(typePlan("Charizard daily"), { premium: false, openAccess: false });
t("switch off: a free seat stays weekly", freeDaily.plan.frequency === "weekly" && freeDaily.notes.length > 0);
const paid = gatePlan({ ...typePlan("Charizard daily"), channels: { discord: true, email: false }, addons: { all: true } }, { premium: true, openAccess: false });
t("premium can keep a daily read and all add-ons", paid.plan.frequency === "daily" && paid.plan.addons.news && paid.plan.addons.games && paid.plan.channels.discord === true && paid.plan.channels.email === false);
const crowdedOpen = gatePlan({ sets: ["A", "B"], pokemon: ["Pika"], sealed: true, singles: true, watch: [{ name: "One" }, { name: "Two" }], frequency: "weekly", channels: { discord: true }, addons: {} }, { premium: false });
const followN = (p) => p.sets.length + p.pokemon.length + p.watch.length + (p.sealed ? 1 : 0) + (p.singles ? 1 : 0);
t("open access keeps every follow up to 25", crowdedOpen.plan && followN(crowdedOpen.plan) === 7);
const crowded = gatePlan({ sets: ["A", "B"], pokemon: ["Pika"], sealed: true, singles: true, watch: [{ name: "One" }, { name: "Two" }], frequency: "weekly", channels: { discord: true }, addons: {} }, { premium: false, openAccess: false });
t("switch off: a free seat keeps one follow", crowded.plan && followN(crowded.plan) === 1);
const fields = new URLSearchParams("discord=0&discord=1&email_on=0&news=0&news=1&frequency=weekly&rarity=Illustration+Rare");
const parsed = gatePlan(planFromFields(fields), { premium: true });
t("discord stays on and email stays off", parsed.plan.channels.discord === true && parsed.plan.channels.email === false && parsed.plan.addons.news === true && parsed.plan.rarities[0] === "Illustration Rare");
const page = renderReadsPage({ signedIn: false, line: "Eeveelutions IRs from Scarlet and Violet, weekly" });
const armedPage = renderReadsPage({ signedIn: false, emailArmed: true, line: "Eeveelutions IRs from Scarlet and Violet, weekly" });
t("email is coming soon until the key is set", page.includes("Email delivery is coming soon.") && !page.includes('name="email"') && !page.includes('name="email_on"') && !page.includes('type="radio" name="length"'));
t("the picker offers Email next to Discord DM", armedPage.includes("Discord DM") && armedPage.includes(">Email<") && armedPage.includes('name="email"') && armedPage.includes('name="email_on"') && !armedPage.includes('name="email_on" value="1" checked') && !armedPage.includes("coming soon") && page.includes(">Save<") && !page.includes("Keep this plan") && page.includes("Scarlet and Violet") && page.includes("Sample read.") && page.indexOf('id="rd-preview"') < page.indexOf('id="rd-form"') && page.includes('<h2 id="rd-sample-h">Sample read</h2>'));
t("unsigned reads have no Discord save wall or cap line", page.includes("This read is free.") && page.includes("TCGplayer market. The date is in the line.") && !page.includes("Saving still needs Discord") && !page.includes("Sign in with Discord to save this read") && !page.includes("Sign in with Discord to save a read") && !page.includes("You can use a daily read and up to 25 follows") && !page.includes("Free is one weekly read") && !page.includes('href="/premium"') && page.includes("catchem-reads") && page.includes("Saved on this device."));
t("one save button", (page.match(/<button type="submit"/g) || []).length === 1);
t("a blank picker starts on the recommended set", renderReadsPage({ signedIn: false }).includes("ME: 30th Celebration") && renderReadsPage({ signedIn: false }).includes("me-30th-celebration"));
t("a saved plan is one Discord follow", (() => {
  const row = planToFollow("d:42", { sets: ["me-30th-celebration"], product: "singles", frequency: "weekly", watch: [], addons: {} });
  const doc = upsertFollow({ follows: [{ id: "9" }] }, row);
  return row.discordId === "42" && row.sets[0] === "me-30th-celebration" && doc.follows.length === 2 && doc.follows[1].id === "42";
})());
t("a signed-out picker does not ping clicks", !page.includes("/api/reads/click"));
t("a signed-in picker pings clicks", renderReadsPage({ signedIn: true }).includes("/api/reads/click"));
t("the picker copy is clean", preSend(page.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).ok);
t("an email letter hides when email is off", emailLetter({ channels: { email: false }, addons: { news: true } }, { news: [{ headline: "H", line: "L", url: "https://press.pokemon.com/en/x" }] }) === "");
const letter = emailLetter(
  { channels: { email: true }, addons: { news: true, games: false } },
  { watch: [{ line: "Charizard is on the list." }], lead: "One dated line.", news: [{ headline: "Set day", line: "The set page names the day.", url: "https://press.pokemon.com/en/x" }, { headline: "Long", line: "x".repeat(300), url: "https://press.pokemon.com/en/y" }] },
);
t("an email letter keeps a short news line and drops a long body", letter.includes("Set day") && letter.includes("Your watchlist") && !letter.includes("x".repeat(80)) && preSend(letter).ok);
t("email does not send without a key", emailSendAllowed({}) === false && emailSendAllowed({ READS_EMAIL_KEY: "abc" }) === true);
t("clicks store counts only", JSON.stringify(bumpClick({ opens: 1, taps: 0, note: "secret" }, "tap")) === JSON.stringify({ opens: 1, taps: 1 }));
t("reads is a page", pageKind("/reads") === "reads");
const poolLines = {
  "set:sv-prismatic-evolutions": "SV: Prismatic Evolutions: top cards on TCGplayer market are #161/131 at $1,250.07, as of Oct 17.",
  "pokemon:Umbreon": "Umbreon ex 161/131, Prismatic Evolutions is $1,250.07 on TCGplayer market, as of Oct 17.",
  "rarity:Special Illustration Rare": "Umbreon ex 161/131, Prismatic Evolutions is $1,250.07 on TCGplayer market, as of Oct 17.",
  "era:Scarlet and Violet": "SV: Prismatic Evolutions: top cards on TCGplayer market are #161/131 at $1,250.07, as of Oct 17.",
  "product:sealed": "Prismatic Evolutions Elite Trainer Box: 12 eBay listings counted, middle ask $90.00, as of Oct 17.",
};
const picked = { sets: ["sv-prismatic-evolutions"], pokemon: ["Umbreon"], rarities: ["Special Illustration Rare"], eras: ["Scarlet and Violet"], product: "singles", watch: [], addons: {} };
t("a sample line is shown for each pick from the pool", sampleRead(picked, poolLines).includes("Umbreon ex 161/131, Prismatic Evolutions") && sampleRead(picked, poolLines).includes("#161/131") && !sampleRead(picked, poolLines).includes("listings counted"));
t("a sealed pick shows the sealed sample and not a card line", sampleRead({ product: "sealed", sets: [], pokemon: [], rarities: [], eras: [], watch: [] }, poolLines).includes("listings counted") && !sampleRead({ product: "sealed", sets: [], pokemon: [], rarities: [], eras: [], watch: [] }, poolLines).includes("Umbreon"));
t("an empty pool still says the night file fills the line", sampleRead(picked, {}).startsWith("Sample read."));
const previewPage = renderReadsPage({ signedIn: false, plan: picked, preview: { lines: poolLines } });
const previewSample = previewPage.split('id="rd-sample">')[1].split("</p>")[0];
t("the reads preview renders one pool line per pick", previewSample.includes("Umbreon ex 161/131, Prismatic Evolutions") && previewSample.includes("#161/131") && !previewSample.includes("listings counted") && previewPage.includes("id=\"rd-lines\"") && previewPage.includes('<h2 id="rd-sample-h">One published read</h2>') && previewPage.indexOf('id="rd-preview"') < previewPage.indexOf('id="rd-form"'));
t("the preview copy is clean", preSend(previewPage.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).ok);
const foreignChip = { name: "Leafeon (Call of Legends) 13/95", signals: [{ kind: "move", dir: "up", text: "18% 7D", label: "Price up 18 percent over 7 days" }], blurb: "TCGplayer market is up 18% over 7 days, as of Oct 17." };
const chipDoc = { asOf: "2026-10-17", byId: { leaf: foreignChip } };
const foreign = renderReadsPage({ signedIn: false, plan: picked, preview: { lines: poolLines, chips: chipDoc } });
const foreignHost = foreign.split('id="rd-chip">')[1].split("</div>")[0];
t("a sample does not wear another card's chips", foreign.includes("Umbreon ex 161/131") && !foreignHost.includes("18% 7D") && !foreignHost.includes("Leafeon"));
const own = renderReadsPage({
  signedIn: false,
  plan: { sets: [], pokemon: ["Leafeon"], rarities: [], eras: [], product: "singles", watch: [], addons: {} },
  preview: {
    lines: { "pokemon:Leafeon": "Leafeon (Call of Legends) 13/95 is $57.57 on TCGplayer market, as of Oct 17." },
    chips: chipDoc,
  },
});
t("a sample keeps chips when the line names that card", own.includes("18% 7D") && own.includes("id=\"rd-chip\"") && preSend(own.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).ok);

const html = await renderPath("/reads", async () => { throw new Error("no data"); }, { feed: false, reads: { signedIn: false, premium: false } });
const body = await html.text();
t("the reads page renders without catalog data", html.status === 200 && body.includes("Your reads") && body.includes("Add-ons") && !body.includes("No data"));


const unsignedGet = await handleReads(new Request("https://catchemtcg.com/api/reads"), {});
const unsignedGetBody = await unsignedGet.json();
t("unsigned reads GET is device only", unsignedGet.status === 200 && unsignedGetBody.ok === true && unsignedGetBody.deviceOnly === true);
const unsignedPost = await handleReads(new Request("https://catchemtcg.com/api/reads", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ frequency: "weekly", sets: ["me-30th-celebration"] }),
}), {});
const unsignedPostBody = await unsignedPost.json();
t("unsigned reads POST does not write or demand Discord", unsignedPost.status === 200 && unsignedPostBody.ok === true && unsignedPostBody.deviceOnly === true && unsignedPostBody.plan == null);
const unsignedForm = await handleReads(new Request("https://catchemtcg.com/api/reads", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "frequency=weekly&set=me-30th-celebration",
  redirect: "manual",
}), {});
const loc = unsignedForm.headers.get("location") || "";
t("unsigned form save stays on /reads", unsignedForm.status === 303 && loc.includes("/reads") && loc.includes("saved=1") && loc.includes("note=device") && !loc.includes("/auth/discord"));

if (fail) process.exit(1);
console.log("reads ok");
