import { createClient } from "@supabase/supabase-js";
import { registrationMonthToDate } from "../src/lib/resale";
import { retry } from "../src/lib/network";
import { oneMapBlockSearch } from "../src/lib/geocoding";

const datasetId = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ONEMAP_EMAIL;
const password = process.env.ONEMAP_PASSWORD;
if (!url || !serviceRoleKey || !email || !password) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ONEMAP_EMAIL, and ONEMAP_PASSWORD in .env.local");

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
type SourceRow = { month: string; town: string; flat_type: string; block: string; street_name: string; storey_range: string; floor_area_sqm: string; lease_commence_date: string; resale_price: string };
type Address = Pick<SourceRow, "block" | "street_name" | "town">;

const batches = <T,>(items: T[], size = 500) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
const transactionKey = (row: SourceRow) => [row.month, row.block, row.street_name, row.flat_type, row.storey_range, row.floor_area_sqm, row.resale_price].join("|");
const coordinateKey = (row: Pick<SourceRow, "block" | "street_name">) => `${row.block}|${row.street_name}`;
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function rateLimiter(minimumIntervalMilliseconds: number) {
  let nextStart = 0;
  return async () => {
    const now = Date.now();
    const scheduled = Math.max(now, nextStart);
    nextStart = scheduled + minimumIntervalMilliseconds;
    await wait(scheduled - now);
  };
}

async function getToken() {
  const response = await retry(() => fetch("https://www.onemap.gov.sg/api/auth/post/getToken", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }), { label: "OneMap authentication" });
  if (!response.ok) throw new Error(`OneMap authentication failed (${response.status})`);
  return (await response.json() as { access_token: string }).access_token;
}

async function downloadDataset(): Promise<SourceRow[]> {
  const rows: SourceRow[] = [];
  for (let offset = 0; ; offset += 10_000) {
    const response = await retry(() => fetch(`https://data.gov.sg/api/action/datastore_search?resource_id=${datasetId}&limit=10000&offset=${offset}`), { label: `data.gov.sg page ${offset / 10_000 + 1}` });
    if (!response.ok) throw new Error(`data.gov.sg download failed (${response.status})`);
    const page = (await response.json() as { result: { records: SourceRow[] } }).result.records;
    rows.push(...page);
    if (page.length < 10_000) return rows;
  }
}

async function latestSourceMonth() {
  const response = await retry(() => fetch(`https://data.gov.sg/api/action/datastore_search?resource_id=${datasetId}&limit=1&sort=month%20desc`), { label: "latest data.gov.sg month" });
  if (!response.ok) throw new Error(`data.gov.sg latest-month query failed (${response.status})`);
  const rows = (await response.json() as { result: { records: Array<Pick<SourceRow, "month">> } }).result.records;
  if (!rows[0]?.month) throw new Error("data.gov.sg returned no resale transactions");
  return rows[0].month;
}

async function metadata(key: string) {
  const { data, error } = await supabase.from("hdb_app_metadata").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

async function loadAddresses(): Promise<Address[]> {
  const addresses: Address[] = [];
  for (let offset = 0; ; offset += 1_000) {
    const { data, error } = await supabase.from("hdb_block_addresses").select("block, street_name, town").range(offset, offset + 999);
    if (error) throw error;
    addresses.push(...(data ?? []));
    if (!data || data.length < 1_000) return addresses;
  }
}

async function saveTransactions(rows: SourceRow[], sourceMonth: string) {
  const transactions = rows.map((row) => ({ transaction_key: transactionKey(row), month: registrationMonthToDate(row.month), town: row.town, flat_type: row.flat_type, block: row.block, street_name: row.street_name, storey_range: row.storey_range, floor_area_sqm: Number(row.floor_area_sqm), lease_commence_year: Number(row.lease_commence_date), resale_price: Number(row.resale_price) }));
  const transactionBatches = batches(transactions);
  console.log(`[2/4] Upserting ${transactions.length.toLocaleString()} transactions in ${transactionBatches.length} batches.`);
  for (const [index, batch] of transactionBatches.entries()) {
    const { error } = await supabase.from("hdb_transactions").upsert(batch, { onConflict: "transaction_key", ignoreDuplicates: true });
    if (error) throw error;
    if ((index + 1) % 25 === 0 || index + 1 === transactionBatches.length) console.log(`  Transactions ${index + 1}/${transactionBatches.length} batches complete.`);
  }
  const addresses = [...new Map(rows.map((row) => [coordinateKey(row), { block: row.block, street_name: row.street_name, town: row.town }])).values()];
  for (const batch of batches(addresses)) {
    const { error } = await supabase.from("hdb_block_addresses").upsert(batch, { onConflict: "block,street_name" });
    if (error) throw error;
  }
  const { error: checkpointError } = await supabase.from("hdb_app_metadata").upsert({ key: "transactions_through", value: sourceMonth }, { onConflict: "key" });
  if (checkpointError) throw checkpointError;
  return addresses;
}

async function cacheCoordinates(uniqueAddresses: Address[], accessToken: string) {
  const cachedCoordinates = new Set<string>();
  for (let offset = 0; ; offset += 1_000) {
    const { data, error } = await supabase.from("hdb_block_coordinates").select("block, street_name").range(offset, offset + 999);
    if (error) throw error;
    for (const coordinate of data ?? []) cachedCoordinates.add(`${coordinate.block}|${coordinate.street_name}`);
    if (!data || data.length < 1_000) break;
  }
  const missingAddresses = uniqueAddresses.filter((row) => !cachedCoordinates.has(coordinateKey(row)));
  let geocoded = 0;
  let unmatched = 0;
  let completed = 0;
  const requestSlot = rateLimiter(240); // 250 calls/minute; OneMap permits 300.
  console.log(`[3/4] Found ${cachedCoordinates.size.toLocaleString()} cached coordinates; geocoding ${missingAddresses.length.toLocaleString()} remaining blocks with 4 workers at ≤250 OneMap calls/minute.`);
  async function geocode(row: Address) {
    try {
      const query = new URLSearchParams({ searchVal: oneMapBlockSearch(row.block, row.street_name), returnGeom: "Y", getAddrDetails: "Y", pageNum: "1" });
      const response = await retry(async () => {
        await requestSlot();
        return fetch(`https://www.onemap.gov.sg/api/common/elastic/search?${query}`, { headers: { Authorization: accessToken } }).then((result) => {
        if (result.status === 429 || result.status >= 500) throw new Error(`OneMap search returned HTTP ${result.status}`);
        return result;
        });
      }, { label: `OneMap geocode for BLK ${row.block} ${row.street_name}` });
      if (!response.ok) throw new Error(`OneMap search returned HTTP ${response.status}`);
      const body = await response.json() as { results?: Array<{ LATITUDE: string; LONGITUDE: string }> };
      const hit = body.results?.[0];
      if (hit) {
        const { error: insertError } = await supabase.from("hdb_block_coordinates").upsert({ block: row.block, street_name: row.street_name, latitude: Number(hit.LATITUDE), longitude: Number(hit.LONGITUDE) }, { onConflict: "block,street_name", ignoreDuplicates: true });
        if (insertError) throw insertError;
        geocoded += 1;
      } else {
        unmatched += 1;
      }
    } finally {
      completed += 1;
      if (completed % 25 === 0 || completed === missingAddresses.length) console.log(`  Coordinates ${completed}/${missingAddresses.length} remaining · ${cachedCoordinates.size} already cached · ${geocoded} fetched · ${unmatched} unmatched`);
    }
  }
  const queue = [...missingAddresses];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let row = queue.shift(); row; row = queue.shift()) await geocode(row);
  }));
}

async function main() {
  console.time("HDB import");
  console.log("[1/4] Checking the newest official resale month.");
  const sourceMonth = await latestSourceMonth();
  const importedMonth = await metadata("transactions_through");
  const addresses = sourceMonth === importedMonth
    ? (console.log(`[2/4] Transactions already loaded through ${sourceMonth}; skipping full download.`), await loadAddresses())
    : (console.log(`[2/4] Downloading official resale transactions (${importedMonth ?? "no checkpoint"} → ${sourceMonth}).`), await downloadDataset().then(async (rows) => { console.log(`  Downloaded ${rows.length.toLocaleString()} transactions.`); return saveTransactions(rows, sourceMonth); }));
  if (addresses.length === 0) throw new Error("No HDB block addresses are available for geocoding");
  await cacheCoordinates(addresses, await getToken());
  console.log("[4/4] Refreshing block summaries and data-through date.");
  const { error: refreshError } = await supabase.rpc("refresh_hdb_block_summaries");
  if (refreshError) throw refreshError;
  const { error: metadataError } = await supabase.from("hdb_app_metadata").upsert({ key: "data_through", value: sourceMonth }, { onConflict: "key" });
  if (metadataError) throw metadataError;
  console.log(`Import complete through ${sourceMonth}.`);
  console.timeEnd("HDB import");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
