import type { MapColourBandCounts } from "./map-colour-scale.generated";

export type Transaction = {
  month: string;
  flatType: string;
  floorAreaSqm: number;
  storeyRange: string;
  leaseCommenceYear: number;
  resalePrice: number;
};

export type BlockSummary = {
  id: string;
  block: string;
  streetName: string;
  town: string;
  flatType: string;
  latitude: number;
  longitude: number;
  medianPsm: number;
  medianPrice: number;
  transactionCount: number;
  transactions?: Transaction[];
};

export type MapCluster = {
  kind: "cluster";
  id: string;
  latitude: number;
  longitude: number;
  clusterCount: number;
  priceBandCounts: MapColourBandCounts;
};

export type MapMarker = (BlockSummary & { kind: "block" }) | MapCluster;

export type MapFilters = {
  flatType: string;
  priceBand: "any" | "under-650" | "650-850" | "850-plus";
  leaseBand: "any" | "80-plus" | "70-79" | "60-69" | "under-60";
};
