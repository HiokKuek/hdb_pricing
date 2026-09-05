import { createClient } from "@supabase/supabase-js";
import { demoBlocks } from "./demo-data";
import type { BlockSummary, MapFilters, MapMarker } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = url && serviceRoleKey ? createClient(url, serviceRoleKey, { auth: { persistSession: false } }) : null;
const flatTypes = ["1 ROOM", "2 ROOM", "3 ROOM", "4 ROOM", "5 ROOM", "EXECUTIVE", "MULTI-GENERATION"];
export const DEFAULT_MAP_CENTER: [number, number] = [1.3521, 103.8198];
export const DEFAULT_MAP_ZOOM = 13;
export const DEFAULT_MAP_BOUNDS: MapBounds = { south: 1.305, west: 103.745, north: 1.4, east: 103.9 };
export const DEFAULT_MAP_FILTERS: MapFilters = { flatType: "all", priceBand: "any", leaseBand: "any" };

export type MapBounds = { south: number; west: number; north: number; east: number };

type MapMarkerRow = {
  marker_kind: "block" | "cluster";
  marker_id: string;
  latitude: number | string;
  longitude: number | string;
  block: string | null;
  street_name: string | null;
  town: string | null;
  flat_type: string | null;
  median_psm: number | string | null;
  median_price: number | string | null;
  transaction_count: number | null;
  cluster_count: number | null;
  under_560_count: number | null;
  from_560_to_650_count: number | null;
  from_650_to_745_count: number | null;
  above_745_count: number | null;
};

function toMapMarker(row: MapMarkerRow): MapMarker {
  if (row.marker_kind === "cluster") {
    return {
      kind: "cluster",
      id: row.marker_id,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      clusterCount: Number(row.cluster_count ?? 0),
      priceBandCounts: {
        under560: Number(row.under_560_count ?? 0),
        from560To650: Number(row.from_560_to_650_count ?? 0),
        from650To745: Number(row.from_650_to_745_count ?? 0),
        above745: Number(row.above_745_count ?? 0),
      },
    };
  }

  return {
    kind: "block",
    id: row.marker_id,
    block: row.block ?? "",
    streetName: row.street_name ?? "",
    town: row.town ?? "",
    flatType: row.flat_type ?? "",
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    medianPsm: Number(row.median_psm ?? 0),
    medianPrice: Number(row.median_price ?? 0),
    transactionCount: Number(row.transaction_count ?? 0),
  };
}

export async function getMapMarkers(bounds: MapBounds, zoom: number, filters: MapFilters): Promise<MapMarker[]> {
  if (!supabase) {
    return demoBlocks
      .filter((block) => (
        (filters.flatType === "all" || block.flatType === filters.flatType)
        && (filters.priceBand === "any"
          || (filters.priceBand === "under-650" && block.medianPrice < 650000)
          || (filters.priceBand === "650-850" && block.medianPrice >= 650000 && block.medianPrice < 850000)
          || (filters.priceBand === "850-plus" && block.medianPrice >= 850000))
        && (filters.leaseBand === "any"
          || (filters.leaseBand === "80-plus" && 99 - (2026 - block.transactions![0].leaseCommenceYear) >= 80)
          || (filters.leaseBand === "70-79" && 99 - (2026 - block.transactions![0].leaseCommenceYear) >= 70 && 99 - (2026 - block.transactions![0].leaseCommenceYear) <= 79)
          || (filters.leaseBand === "60-69" && 99 - (2026 - block.transactions![0].leaseCommenceYear) >= 60 && 99 - (2026 - block.transactions![0].leaseCommenceYear) <= 69)
          || (filters.leaseBand === "under-60" && 99 - (2026 - block.transactions![0].leaseCommenceYear) < 60))
      ))
      .map((block) => ({ ...block, kind: "block" as const }));
  }

  const { data, error } = await supabase.rpc("get_hdb_map_markers", {
    p_south: bounds.south,
    p_west: bounds.west,
    p_north: bounds.north,
    p_east: bounds.east,
    p_zoom: Math.round(zoom),
    p_flat_type: filters.flatType,
    p_price_band: filters.priceBand,
    p_lease_band: filters.leaseBand,
  });
  if (error) throw error;
  return ((data ?? []) as MapMarkerRow[]).map(toMapMarker);
}

export async function getBlockTransactions(blockId: string): Promise<BlockSummary["transactions"]> {
  if (!supabase) return demoBlocks.find((block) => block.id === blockId)?.transactions ?? [];
  const { data, error } = await supabase.from("hdb_block_summaries").select("transactions").eq("block_id", blockId).maybeSingle();
  if (error) throw error;
  return (data?.transactions as BlockSummary["transactions"]) ?? [];
}

export async function getInitialMapData(): Promise<{ markers: MapMarker[]; flatTypes: string[]; filters: MapFilters; bounds: MapBounds; zoom: number }> {
  try {
    return {
      markers: await getMapMarkers(DEFAULT_MAP_BOUNDS, DEFAULT_MAP_ZOOM, DEFAULT_MAP_FILTERS),
      flatTypes,
      filters: DEFAULT_MAP_FILTERS,
      bounds: DEFAULT_MAP_BOUNDS,
      zoom: DEFAULT_MAP_ZOOM,
    };
  } catch {
    return {
      markers: demoBlocks.map((block) => ({ ...block, kind: "block" as const })),
      flatTypes,
      filters: DEFAULT_MAP_FILTERS,
      bounds: DEFAULT_MAP_BOUNDS,
      zoom: DEFAULT_MAP_ZOOM,
    };
  }
}
