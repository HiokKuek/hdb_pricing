import { NextRequest, NextResponse } from "next/server";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (!email || !password) return null;
  const response = await fetch("https://www.onemap.gov.sg/api/auth/post/getToken", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!response.ok) throw new Error("Unable to authenticate with OneMap");
  const body = await response.json() as { access_token: string; expiry_timestamp: string };
  cachedToken = { value: body.access_token, expiresAt: Number(body.expiry_timestamp) * 1000 - 60_000 };
  return cachedToken.value;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json({ results: [] });
  try {
    const accessToken = await getToken();
    if (!accessToken) return NextResponse.json({ results: [] });
    const query = new URLSearchParams({ searchVal: q, returnGeom: "Y", getAddrDetails: "Y", pageNum: "1" });
    const response = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?${query}`, { headers: { Authorization: accessToken } });
    const body = await response.json() as { results?: Array<{ ADDRESS: string; LATITUDE: string; LONGITUDE: string }> };
    return NextResponse.json({ results: (body.results ?? []).slice(0, 5).map((item) => ({ address: item.ADDRESS, latitude: Number(item.LATITUDE), longitude: Number(item.LONGITUDE) })) });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
