import assert from "node:assert/strict";
import { tcgPid } from "../src/catalogue-image.mjs";
assert.equal(tcgPid({ id: "me2-etb", tcgPlayerId: "654136" }), 654136);
assert.equal(tcgPid({ id: "me2-etb", tcgcsvId: "tcgcsv-654136" }), 654136);
assert.equal(tcgPid({ id: "me2-etb", tcgPlayerId: null }), 0);
assert.equal(tcgPid({ id: "tcgcsv-5", tcgPlayerId: "9" }), 5);
console.log("sealed pid ok");
