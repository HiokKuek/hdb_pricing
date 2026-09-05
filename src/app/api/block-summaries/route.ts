import { NextRequest, NextResponse } from "next/server";
import { getMapMarkers } from "@/lib/blocks";
import type { MapFilters } from "@/lib/types";

export async function GET(request: NextRequest) {
  const flatType = request.nextUrl.searchParams.get("flatType")?.trim() || "all";
  const priceBand = request.nextUrl.searchParams.get("priceBand")?.trim() || "any";
  const leaseBand = request.nextUrl.searchParams.get("leaseBand")?.trim() || "any";
  const zoom = Number(request.nextUrl.searchParams.get("zoom"));
  if (!["any", "under-650", "650-850", "850-plus"].includes(priceBand)) return NextResponse.json({ error: "Invalid price filter." }, { status: 400 });
  if (!["any", "80-plus", "70-79", "60-69", "under-60"].includes(leaseBand)) return NextResponse.json({ error: "Invalid lease filter." }, { status: 400 });
  const values = ["south", "west", "north", "east"].map((key) => Number(request.nextUrl.searchParams.get(key)));
  const [south, west, north, east] = values;
  if (!values.every(Number.isFinite) || !Number.isFinite(zoom)) return NextResponse.json({ error: "Map bounds and zoom are required." }, { status: 400 });
  const filters: MapFilters = { flatType, priceBand: priceBand as MapFilters["priceBand"], leaseBand: leaseBand as MapFilters["leaseBand"] };
  return NextResponse.json({ markers: await getMapMarkers({ south, west, north, east }, zoom, filters) });
}
