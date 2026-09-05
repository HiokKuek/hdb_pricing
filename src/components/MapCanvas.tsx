"use client";

import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import type { BlockSummary, MapCluster, MapMarker, PriceBand } from "@/lib/types";
import { DEFAULT_MAP_CENTER } from "@/lib/blocks";
import { toPsf } from "@/lib/pricing";

type Props = {
  markers: MapMarker[];
  selectedId: string | null;
  focus: [number, number] | null;
  onSelect: (block: BlockSummary) => void;
  onViewportChange: (viewport: { bounds: { south: number; west: number; north: number; east: number }; zoom: number }) => void;
  initialZoom: number;
};

const colours: Record<PriceBand, string> = {
  "under-6000": "#74c8ba",
  "6000-7000": "#d9bb61",
  "7000-8000": "#e88858",
  "8000-plus": "#bc4a45"
};

function band(value: number): PriceBand {
  if (value < 560) return "under-6000";
  if (value < 650) return "6000-7000";
  if (value < 745) return "7000-8000";
  return "8000-plus";
}

function Reframe({ focus }: { focus: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo(focus, 15, { duration: 0.8 });
  }, [map, focus]);
  return null;
}

function ViewportObserver({ onViewportChange }: Pick<Props, "onViewportChange">) {
  const map = useMap();
  useEffect(() => {
    const report = () => {
      const bounds = map.getBounds();
      onViewportChange({ bounds: { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() }, zoom: map.getZoom() });
    };
    report();
    map.on("moveend", report);
    return () => { map.off("moveend", report); };
  }, [map, onViewportChange]);
  return null;
}

function MapSizeObserver() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(container);
    map.invalidateSize();
    return () => resizeObserver.disconnect();
  }, [map]);

  return null;
}

function clusterIcon(cluster: MapCluster, hovered: boolean) {
  const { under560, from560To650, from650To745, above745 } = cluster.priceBandCounts;
  const total = cluster.clusterCount || 1;
  const stops = [
    ["#74c8ba", under560],
    ["#d9bb61", from560To650],
    ["#e88858", from650To745],
    ["#bc4a45", above745],
  ] as const;
  let cursor = 0;
  const gradient = stops.map(([colour, count]) => {
    const start = cursor;
    cursor += (count / total) * 100;
    return `${colour} ${start}% ${cursor}%`;
  }).join(", ");
  const baseSize = Math.min(48, 24 + Math.round(Math.log2(total + 1) * 5));
  const size = hovered ? baseSize + 8 : baseSize;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div aria-label="${total} homes" style="width:${size}px;height:${size}px;background:conic-gradient(${gradient});border:2px solid #ffffff;border-radius:50%;box-shadow:0 1px 5px rgb(0 0 0 / 30%);color:#183144;cursor:pointer;display:flex;align-items:center;justify-content:center;font:600 11px Inter, sans-serif">${total}</div>`,
  });
}

function ClusterMarkers({ clusters }: { clusters: MapCluster[] }) {
  const map = useMap();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  return clusters.map((cluster) => (
    <Marker
      key={cluster.id}
      position={[cluster.latitude, cluster.longitude]}
      icon={clusterIcon(cluster, hoveredId === cluster.id)}
      title={`${cluster.clusterCount} homes — click to zoom in`}
      eventHandlers={{
        click: () => map.flyTo([cluster.latitude, cluster.longitude], Math.min(map.getZoom() + 2, 15), { duration: 0.5 }),
        mouseover: () => setHoveredId(cluster.id),
        mouseout: () => setHoveredId(null),
      }}
    />
  ));
}

export default function MapCanvas({ markers, selectedId, focus, onSelect, onViewportChange, initialZoom }: Props) {
  const canvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const blocks = markers.filter((marker): marker is BlockSummary & { kind: "block" } => marker.kind === "block");
  const clusters = markers.filter((marker): marker is MapCluster => marker.kind === "cluster");
  return (
    <MapContainer center={DEFAULT_MAP_CENTER} zoom={initialZoom} scrollWheelZoom preferCanvas className="sgds:h-full sgds:w-full" zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.onemap.gov.sg/">OneMap</a>'
        url="https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png"
      />
      <Reframe focus={focus} />
      <ViewportObserver onViewportChange={onViewportChange} />
      <MapSizeObserver />
      <ClusterMarkers clusters={clusters} />
      {blocks.map((block) => {
        const isSelected = block.id === selectedId;
        const isHovered = block.id === hoveredBlockId;
        return (
          <CircleMarker
            key={block.id}
            center={[block.latitude, block.longitude]}
            radius={isSelected || isHovered ? 12 : 9}
            pathOptions={{ color: "#f7f5ef", weight: isSelected ? 4 : isHovered ? 3 : 2, fillColor: colours[band(toPsf(block.medianPsm))], fillOpacity: 1, renderer: canvasRenderer }}
            eventHandlers={{ click: () => onSelect(block), mouseover: () => setHoveredBlockId(block.id), mouseout: () => setHoveredBlockId(null) }}
          >
            <Tooltip direction="top" offset={[0, -9]} opacity={1}>
              <strong>BLK {block.block}</strong><br />${Math.round(toPsf(block.medianPsm)).toLocaleString()}/sq ft
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
