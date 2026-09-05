import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { classifyMapColourScale } from "../src/lib/map-colour-scale.generated";
import { toMapColourBandCounts } from "../src/lib/blocks";

assert.equal(classifyMapColourScale(559.99), "under-560");
assert.equal(classifyMapColourScale(560), "560-650");
assert.equal(classifyMapColourScale(650), "650-745");
assert.equal(classifyMapColourScale(745), "745-plus");
assert.deepEqual(toMapColourBandCounts({ under_560_count: 2, from_560_to_650_count: 3, from_650_to_745_count: 5, above_745_count: 7 }), {
  "under-560": 2,
  "560-650": 3,
  "650-745": 5,
  "745-plus": 7,
});
execFileSync(process.execPath, ["--import", "tsx", "scripts/generate-map-colour-scale.ts", "--check"], { stdio: "inherit" });
console.log("Map Colour Scale contract passes");
