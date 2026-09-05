import { strict as assert } from "node:assert";
import { registrationMonthToDate } from "../src/lib/resale";

const storedMonth = registrationMonthToDate("2017-01");
assert.match(storedMonth, /^\d{4}-\d{2}-\d{2}$/, "Supabase date columns require YYYY-MM-DD values");
assert.equal(storedMonth, "2017-01-01");
console.log("registration month normalization passes");
