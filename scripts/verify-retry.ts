import { strict as assert } from "node:assert";
import { retry } from "../src/lib/network";

async function main() {
  let attempts = 0;
  const value = await retry(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("UND_ERR_SOCKET");
    return "recovered";
  }, { label: "fixture", attempts: 3, onRetry: () => {} });

  assert.equal(value, "recovered");
  assert.equal(attempts, 3);
  console.log("transient retry recovery passes");
}

main();
