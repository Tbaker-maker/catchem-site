import { pageKind, renderPath } from "../src/index.mjs";
import { bumpClick, emailLetter, emailSendAllowed, gatePlan, planFromFields, preSend, renderReadsPage, typePlan } from "../src/reads.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const typed = typePlan("Eeveelutions IRs from Scarlet and Violet, weekly");
t("a plain line becomes a weekly plan", typed && typed.frequency === "weekly" && typed.eras.includes("Scarlet and Violet") && typed.watch[0].name === "Eeveelutions IRs");
const freeDaily = gatePlan(typePlan("Charizard daily"), { premium: false });
t("a free seat stays weekly", freeDaily.plan.frequency === "weekly" && freeDaily.notes.length > 0);
const paid = gatePlan({ ...typePlan("Charizard daily"), channels: { discord: true, email: false }, addons: { all: true } }, { premium: true });
t("premium can keep a daily read and all add-ons", paid.plan.frequency === "daily" && paid.plan.addons.news && paid.plan.addons.games && paid.plan.channels.discord === true && paid.plan.channels.email === false);
const crowded = gatePlan({ sets: ["A", "B"], pokemon: ["Pika"], sealed: true, singles: true, watch: [{ name: "One" }, { name: "Two" }], frequency: "weekly", channels: { discord: true }, addons: {} }, { premium: false });
t("a free seat keeps one follow", crowded.plan && (crowded.plan.sets.length + crowded.plan.pokemon.length + crowded.plan.watch.length + (crowded.plan.sealed ? 1 : 0) + (crowded.plan.singles ? 1 : 0)) === 1);
const fields = new URLSearchParams("discord=0&discord=1&email_on=0&news=0&news=1&frequency=weekly&rarity=Illustration+Rare");
const parsed = gatePlan(planFromFields(fields), { premium: true });
t("discord stays on and email stays off", parsed.plan.channels.discord === true && parsed.plan.channels.email === false && parsed.plan.addons.news === true && parsed.plan.rarities[0] === "Illustration Rare");
const page = renderReadsPage({ signedIn: false, line: "Eeveelutions IRs from Scarlet and Violet, weekly" });
t("the picker defaults Discord and does not force email", page.includes("Discord DM") && page.includes("checked") && page.includes("Email, optional") && page.includes("Keep this plan") && page.includes("/auth/discord?next=/reads"));
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

const html = await renderPath("/reads", async () => { throw new Error("no data"); }, { feed: false, reads: { signedIn: false, premium: false } });
const body = await html.text();
t("the reads page renders without catalog data", html.status === 200 && body.includes("Your reads") && body.includes("Add-ons") && !body.includes("No data"));

if (fail) process.exit(1);
console.log("reads ok");
