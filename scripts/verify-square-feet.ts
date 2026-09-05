import { strict as assert } from "node:assert";
import { toPsf, toSqft } from "../src/lib/pricing";

assert.equal(Math.round(toSqft(92)), 990);
assert.equal(Math.round(toPsf(6_000)), 557);
console.log("square-foot presentation conversion passes");
