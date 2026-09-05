import { strict as assert } from "node:assert";
import { oneMapBlockSearch } from "../src/lib/geocoding";

assert.equal(oneMapBlockSearch("406", "ANG MO KIO AVE 10"), "406 ANG MO KIO AVE 10 SINGAPORE");
assert.doesNotMatch(oneMapBlockSearch("406", "ANG MO KIO AVE 10"), /\bBLK\b/);
console.log("OneMap HDB block query formatting passes");
