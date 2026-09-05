import PriceMap from "@/components/PriceMap";
import { getInitialMapData } from "@/lib/blocks";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getInitialMapData();
  return <PriceMap initialMarkers={data.markers} flatTypes={data.flatTypes} initialFilters={data.filters} initialBounds={data.bounds} initialZoom={data.zoom} />;
}
