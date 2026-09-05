"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SgdsButton,
  SgdsDrawer,
  SgdsIcon,
  SgdsIconButton,
  SgdsInput,
  SgdsSelect,
  SgdsSelectOption,
  SgdsSpinner,
} from "@govtechsg/sgds-web-component/react";
import type { BlockSummary, MapFilters, MapMarker, Transaction } from "@/lib/types";
import type { MapBounds } from "@/lib/blocks";
import { MAP_COLOUR_SCALE } from "@/lib/map-colour-scale.generated";
import { toPsf, toSqft } from "@/lib/pricing";

const MapCanvas = dynamic(() => import("./MapCanvas"), { ssr: false, loading: () => <div className="map-loading">Drawing the field map…</div> });

const currency = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 });
type Place = { address: string; latitude: number; longitude: number };
type ValueElement = HTMLElement & { value: string };
type SelectElement = HTMLElement & { value: string };
type Viewport = { bounds: MapBounds; zoom: number };

function compactAddress(address: string) {
  return address.length > 54 ? `${address.slice(0, 51)}…` : address;
}

export default function PriceMap({ initialMarkers, flatTypes, initialFilters, initialBounds, initialZoom }: { initialMarkers: MapMarker[]; flatTypes: string[]; initialFilters: MapFilters; initialBounds: MapBounds; initialZoom: number }) {
  const [markers, setMarkers] = useState(initialMarkers);
  const [flatType, setFlatType] = useState(initialFilters.flatType);
  const [selected, setSelected] = useState<BlockSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [loadingMarkers, setLoadingMarkers] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ bounds: initialBounds, zoom: initialZoom });
  const [budget, setBudget] = useState<MapFilters["priceBand"]>(initialFilters.priceBand);
  const [leaseBand, setLeaseBand] = useState<MapFilters["leaseBand"]>(initialFilters.leaseBand);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const flatTypeRef = useRef<SelectElement>(null);
  const priceRef = useRef<SelectElement>(null);
  const leaseRef = useRef<SelectElement>(null);
  const visibleMarkers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return markers;
    return markers.filter((marker) => marker.kind === "cluster" || `${marker.block} ${marker.streetName} ${marker.town}`.toLowerCase().includes(normalizedQuery));
  }, [markers, query]);

  useEffect(() => {
    if (query.trim().length < 3) { setPlaces([]); return; }
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/place-search?q=${encodeURIComponent(query)}`);
        if (response.ok) setPlaces((await response.json()).results);
      } catch { setPlaces([]); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsCompactViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { bounds, zoom } = viewport;
    const parameters = new URLSearchParams({
      flatType,
      priceBand: budget,
      leaseBand,
      zoom: String(zoom),
      south: String(bounds.south),
      west: String(bounds.west),
      north: String(bounds.north),
      east: String(bounds.east),
    });
    setLoadingMarkers(true);
    fetch(`/api/block-summaries?${parameters}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("Could not load map markers.")))
      .then((data: { markers: MapMarker[] }) => { setMarkers(data.markers); setSelected(null); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setMarkers([]); })
      .finally(() => { if (!controller.signal.aborted) setLoadingMarkers(false); });
    return () => controller.abort();
  }, [viewport, flatType, budget, leaseBand]);

  useEffect(() => {
    const synchronise = () => {
      const setDisplayValue = (element: SelectElement | null, value: string) => {
        if (!element) return;
        // SGDS Select resolves its display label after its slotted options load.
        // Cycling the value ensures that first paint has both the value and label.
        if (element.value === value) element.value = "";
        element.value = value;
      };
      setDisplayValue(flatTypeRef.current, flatType);
      setDisplayValue(priceRef.current, budget);
      setDisplayValue(leaseRef.current, leaseBand);
    };
    const frame = window.requestAnimationFrame(synchronise);
    const timer = window.setTimeout(synchronise, 100);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [flatType, budget, leaseBand]);

  const updateViewport = useCallback((nextViewport: Viewport) => setViewport((current) => JSON.stringify(current) === JSON.stringify(nextViewport) ? current : nextViewport), []);

  function selectBlock(block: BlockSummary) {
    setFocus(null);
    setSelected(block);
    setTransactions(null);
    fetch(`/api/block-transactions?blockId=${encodeURIComponent(block.id)}`)
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("Could not load transactions.")))
      .then((data: { transactions: Transaction[] }) => setTransactions(data.transactions))
      .catch(() => setTransactions([]));
  }

  function selectPlace(place: Place) {
    setFocus([place.latitude, place.longitude]);
    setQuery(place.address);
    setPlaces([]);
  }

  function getSelectValue(event: Event) {
    return (event.currentTarget as ValueElement).value;
  }

  function updateFlatType(event: Event) {
    setSelected(null);
    setTransactions(null);
    setFlatType(getSelectValue(event));
  }

  function updatePriceBand(event: Event) {
    setBudget(getSelectValue(event) as MapFilters["priceBand"]);
  }

  function updateLeaseBand(event: Event) {
    setLeaseBand(getSelectValue(event) as MapFilters["leaseBand"]);
  }

  return (
    <main className="map-app-shell sgds:relative sgds:overflow-hidden" aria-label="HDB resale price map">
        <div className="sgds:absolute sgds:inset-0"><MapCanvas markers={visibleMarkers} selectedId={selected?.id ?? null} focus={focus} onSelect={selectBlock} onViewportChange={updateViewport} initialZoom={initialZoom} /></div>
        <section className="sgds:absolute sgds:inset-0 sgds:z-800 sgds:pointer-events-none" aria-label="Map controls and resale evidence">
          <div className="map-controls sgds:pointer-events-auto sgds:absolute sgds:left-1/2 sgds:w-[calc(100%-2rem)] sgds:lg:w-[calc(100%-3rem)] sgds:-translate-x-1/2">
            <div className="sgds:hidden sgds:lg:grid sgds:lg:grid-cols-[13rem_minmax(14rem,1fr)_repeat(3,9rem)] sgds:2-xl:grid-cols-[18rem_minmax(14rem,1fr)_repeat(3,9rem)] sgds:lg:items-end sgds:lg:gap-component-xs">
              <header>
                <h1 className="sgds:text-heading-sm sgds:font-semibold sgds:leading-sm sgds:tracking-tight sgds:text-heading-default">HDB Resale Prices</h1>
                <p className="sgds:mt-text-2-xs sgds:text-body-sm sgds:font-regular sgds:leading-2-xs sgds:tracking-normal sgds:text-body-subtle">Distribution of HDB resale prices across Singapore</p>
              </header>
              <div className="sgds:relative sgds:lg:self-center">
                <SgdsInput
                  type="search"
                  aria-label="Search for a place"
                  name="place-search"
                  value={query}
                  onSgdsInput={(event) => setQuery((event.target as ValueElement).value)}
                  placeholder="Search block, street or town"
                />
                <SgdsIconButton
                  className="map-search-action sgds:absolute sgds:right-2 sgds:top-1/2 sgds:-translate-y-1/2"
                  name="search"
                  variant="ghost"
                  ariaLabel="Show the first matching HDB location"
                  disabled={places.length === 0}
                  onClick={() => { if (places[0]) selectPlace(places[0]); }}
                />
                {places.length > 0 && (
                  <div className="sgds:absolute sgds:z-900 sgds:mt-1 sgds:w-full sgds:bg-surface-raised sgds:border sgds:border-default sgds:rounded-md sgds:shadow-lg sgds:p-1">
                    {places.map((place) => (
                      <SgdsButton key={`${place.latitude}-${place.longitude}`} variant="ghost" fullWidth ariaLabel={place.address} onClick={() => selectPlace(place)}>
                        {compactAddress(place.address)}
                      </SgdsButton>
                    ))}
                  </div>
                )}
              </div>
              <div className="sgds:lg:self-center sgds:lg:-translate-y-4">
                <SgdsSelect ref={flatTypeRef} label="Flat type" name="flat-type" value={flatType} placeholder="All flat types" onSgdsChange={updateFlatType} onSgdsSelect={updateFlatType}>
                  <SgdsSelectOption value="all">All flat types</SgdsSelectOption>
                  {flatTypes.map((type) => <SgdsSelectOption key={type} value={type}>{type}</SgdsSelectOption>)}
                </SgdsSelect>
              </div>
              <div className="sgds:lg:self-center sgds:lg:-translate-y-4">
                <SgdsSelect ref={priceRef} label="Price" name="price" value={budget} placeholder="Any price" onSgdsChange={updatePriceBand} onSgdsSelect={updatePriceBand}>
                  <SgdsSelectOption value="any">Any price</SgdsSelectOption>
                  <SgdsSelectOption value="under-650">Under $650k</SgdsSelectOption>
                  <SgdsSelectOption value="650-850">$650k–850k</SgdsSelectOption>
                  <SgdsSelectOption value="850-plus">$850k+</SgdsSelectOption>
                </SgdsSelect>
              </div>
              <div className="sgds:lg:self-center sgds:lg:-translate-y-4">
                <SgdsSelect ref={leaseRef} label="Lease remaining" name="lease" value={leaseBand} placeholder="Any lease" onSgdsChange={updateLeaseBand} onSgdsSelect={updateLeaseBand}>
                  <SgdsSelectOption value="any">Any lease</SgdsSelectOption>
                  <SgdsSelectOption value="80-plus">80+ years</SgdsSelectOption>
                  <SgdsSelectOption value="70-79">70–79 years</SgdsSelectOption>
                  <SgdsSelectOption value="60-69">60–69 years</SgdsSelectOption>
                  <SgdsSelectOption value="under-60">Under 60 years</SgdsSelectOption>
                </SgdsSelect>
              </div>
            </div>
            {loadingMarkers && <div className="sgds:flex sgds:justify-end sgds:mt-text-2-xs"><SgdsSpinner size="xs" tone="neutral" label="Updating map" orientation="horizontal" /></div>}
            <div className="sgds:lg:hidden sgds:bg-surface-raised sgds:border sgds:border-default sgds:rounded-lg sgds:shadow-lg sgds:p-component-xs">
              <header>
                <h1 className="sgds:text-heading-sm sgds:font-semibold sgds:leading-sm sgds:tracking-tight sgds:text-heading-default">HDB Resale Prices</h1>
                <p className="sgds:mt-text-2-xs sgds:text-body-sm sgds:font-regular sgds:leading-2-xs sgds:tracking-normal sgds:text-body-subtle">Distribution of HDB resale prices across Singapore</p>
              </header>
              <div className="sgds:flex sgds:items-end sgds:gap-component-xs sgds:mt-component-sm">
                <div className="sgds:relative sgds:flex-1">
                  <SgdsInput type="search" aria-label="Search for a place" name="place-search-mobile" value={query} onSgdsInput={(event) => setQuery((event.target as ValueElement).value)} placeholder="Search block, street or town" />
                  <SgdsIconButton className="map-search-action sgds:absolute sgds:right-2 sgds:top-1/2 sgds:-translate-y-1/2" name="search" variant="ghost" ariaLabel="Show the first matching HDB location" disabled={places.length === 0} onClick={() => { if (places[0]) selectPlace(places[0]); }} />
                  {places.length > 0 && <div className="sgds:absolute sgds:z-900 sgds:mt-1 sgds:w-full sgds:bg-surface-raised sgds:border sgds:border-default sgds:rounded-md sgds:shadow-lg sgds:p-1">
                    {places.map((place) => <SgdsButton key={`${place.latitude}-${place.longitude}`} variant="ghost" fullWidth ariaLabel={place.address} onClick={() => selectPlace(place)}>{compactAddress(place.address)}</SgdsButton>)}
                  </div>}
                </div>
                <SgdsButton variant="outline" tone="neutral" ariaLabel="Open filters" onClick={() => setMobileFiltersOpen(true)}>
                  <SgdsIcon slot="leftIcon" name="sliders" size="sm" />
                  Filters
                </SgdsButton>
              </div>
              <SgdsDrawer open={mobileFiltersOpen} placement="bottom" size="lg" ariaLabel="Map filters" onSgdsRequestClose={() => setMobileFiltersOpen(false)}>
                <h2 slot="title">Filters</h2>
                <p slot="description">Refine the resale prices shown on the map.</p>
                <div className="sgds:flex sgds:flex-col sgds:gap-component-md sgds:pt-component-sm">
                  <SgdsSelect label="Flat type" name="mobile-flat-type" value={flatType} placeholder="All flat types" onSgdsChange={updateFlatType} onSgdsSelect={updateFlatType}>
                    <SgdsSelectOption value="all">All flat types</SgdsSelectOption>
                    {flatTypes.map((type) => <SgdsSelectOption key={type} value={type}>{type}</SgdsSelectOption>)}
                  </SgdsSelect>
                  <SgdsSelect label="Price" name="mobile-price" value={budget} placeholder="Any price" onSgdsChange={updatePriceBand} onSgdsSelect={updatePriceBand}>
                    <SgdsSelectOption value="any">Any price</SgdsSelectOption>
                    <SgdsSelectOption value="under-650">Under $650k</SgdsSelectOption>
                    <SgdsSelectOption value="650-850">$650k–850k</SgdsSelectOption>
                    <SgdsSelectOption value="850-plus">$850k+</SgdsSelectOption>
                  </SgdsSelect>
                  <SgdsSelect label="Lease remaining" name="mobile-lease" value={leaseBand} placeholder="Any lease" onSgdsChange={updateLeaseBand} onSgdsSelect={updateLeaseBand}>
                    <SgdsSelectOption value="any">Any lease</SgdsSelectOption>
                    <SgdsSelectOption value="80-plus">80+ years</SgdsSelectOption>
                    <SgdsSelectOption value="70-79">70–79 years</SgdsSelectOption>
                    <SgdsSelectOption value="60-69">60–69 years</SgdsSelectOption>
                    <SgdsSelectOption value="under-60">Under 60 years</SgdsSelectOption>
                  </SgdsSelect>
                </div>
                <div slot="footer"><SgdsButton variant="primary" ariaLabel="Apply filters" onClick={() => setMobileFiltersOpen(false)}>Apply filters</SgdsButton></div>
              </SgdsDrawer>
            </div>
          </div>
          <aside className="map-legend sgds:pointer-events-auto sgds:absolute sgds:left-4 sgds:right-4 sgds:flex sgds:flex-nowrap sgds:items-center sgds:gap-component-xs sgds:overflow-x-auto sgds:bg-surface-raised sgds:border sgds:border-default sgds:rounded-lg sgds:shadow-lg sgds:p-component-xs sgds:md:right-auto sgds:md:flex-wrap" aria-label="Price per square foot legend">
            <div className="sgds:shrink-0 sgds:text-overline-md sgds:font-semibold sgds:leading-2-xs sgds:tracking-wide sgds:uppercase sgds:text-body-subtle">Price per sq ft</div>
            {MAP_COLOUR_SCALE.map((band) => <div className="sgds:flex sgds:items-center sgds:gap-text-2-xs" key={band.id}><span className={`map-legend-swatch map-colour-scale-${band.id}`} aria-hidden="true" /><span className="sgds:text-label-sm sgds:font-regular sgds:leading-2-xs sgds:tracking-normal sgds:text-body-default">{band.label}</span></div>)}
          </aside>

          {selected && <>
            {isCompactViewport && <SgdsDrawer open placement="bottom" size="lg" ariaLabel={`Recent transactions for Block ${selected.block}`} onSgdsRequestClose={() => setSelected(null)}>
              <h2 slot="title">Block {selected.block}</h2>
              <p slot="description">{selected.streetName}, {selected.town}</p>
              <div aria-live="polite">
                <div className="sgds:flex sgds:flex-col sgds:gap-text-xs sgds:mb-component-md sgds:pb-component-xs sgds:border-b sgds:border-default">
                  <div className="sgds:text-overline-md sgds:font-semibold sgds:leading-2-xs sgds:tracking-wide sgds:uppercase sgds:text-body-subtle">Median price per sq ft</div>
                  <div className="sgds:text-display-sm sgds:font-bold sgds:leading-xl sgds:tracking-tighter sgds:text-heading-default">${Math.round(toPsf(selected.medianPsm)).toLocaleString()}</div>
                  <div className="sgds:text-caption-md sgds:leading-2-xs sgds:tracking-normal sgds:text-body-subtle">From {selected.transactionCount} matching sales</div>
                </div>
                <div className="sgds:grid sgds:grid-cols-2 sgds:gap-component-sm">
                  <div className="sgds:flex sgds:flex-col sgds:gap-text-2-xs sgds:border-l-4 sgds:border-primary-default sgds:pl-3"><div className="sgds:text-label-sm sgds:leading-2-xs sgds:text-body-subtle">Median sale</div><div className="sgds:text-subtitle-sm sgds:font-semibold sgds:leading-2-xs sgds:text-heading-default">{currency.format(selected.medianPrice)}</div></div>
                  <div className="sgds:flex sgds:flex-col sgds:gap-text-2-xs sgds:border-l-4 sgds:border-primary-default sgds:pl-3"><div className="sgds:text-label-sm sgds:leading-2-xs sgds:text-body-subtle">Sales shown</div><div className="sgds:text-subtitle-sm sgds:font-semibold sgds:leading-2-xs sgds:text-heading-default">{transactions?.length ?? "…"} recent</div></div>
                </div>
                <div className="sgds:flex sgds:justify-between sgds:mt-component-md sgds:mb-component-xs sgds:text-overline-md sgds:font-semibold sgds:leading-2-xs sgds:tracking-wide sgds:uppercase sgds:text-body-subtle"><span>Recent sales</span><span>Price</span></div>
                <div>{transactions ? transactions.map((sale) => <article className="sgds:flex sgds:justify-between sgds:gap-component-xs sgds:py-component-xs sgds:border-t sgds:border-default" key={`${sale.month}-${sale.resalePrice}`}><div className="sgds:min-w-0"><div className="sgds:text-label-md sgds:font-semibold sgds:leading-xs sgds:text-heading-default">{sale.month}</div><div className="sgds:text-caption-md sgds:leading-2-xs sgds:text-body-subtle">{sale.flatType} · {Math.round(toSqft(sale.floorAreaSqm)).toLocaleString()} sq ft · {sale.storeyRange}</div></div><div className="sgds:shrink-0 sgds:text-right"><div className="sgds:text-label-md sgds:font-semibold sgds:leading-xs sgds:text-heading-default">{currency.format(sale.resalePrice)}</div><div className="sgds:text-caption-md sgds:leading-2-xs sgds:text-body-subtle">${Math.round(toPsf(sale.resalePrice / sale.floorAreaSqm)).toLocaleString()}/sq ft</div></div></article>) : <div className="sgds:flex sgds:items-center sgds:gap-component-xs sgds:py-component-xs"><SgdsSpinner size="sm" label="Loading transactions" /><span className="sgds:text-body-sm sgds:leading-2-xs sgds:text-body-subtle">Loading transactions…</span></div>}</div>
                <p className="sgds:text-caption-md sgds:leading-2-xs sgds:tracking-normal sgds:text-body-subtle sgds:mt-component-md">Indicative resale evidence, not a valuation. Individual homes differ by condition, floor, lease, and more.</p>
              </div>
            </SgdsDrawer>}
            <aside className="sgds:hidden sgds:pointer-events-auto sgds:absolute sgds:right-4 sgds:bottom-4 sgds:w-[calc(100%-2rem)] sgds:lg:block sgds:lg:top-40 sgds:lg:bottom-auto sgds:lg:h-[70vh] sgds:lg:max-h-[70vh] sgds:lg:w-80 sgds:overflow-y-auto sgds:bg-surface-raised sgds:border sgds:border-default sgds:rounded-lg sgds:shadow-lg sgds:p-component-xs" aria-live="polite">
            <div className="sgds:flex sgds:items-start sgds:justify-between sgds:gap-component-sm">
              <div className="sgds:flex sgds:flex-col sgds:gap-text-xs">
                <div className="sgds:text-overline-md sgds:font-semibold sgds:leading-2-xs sgds:tracking-wide sgds:uppercase sgds:text-body-subtle">Recent transactions</div>
                <h1 className="sgds:text-heading-lg sgds:font-bold sgds:leading-lg sgds:tracking-tight sgds:text-heading-default">Block {selected.block}</h1>
                <p className="sgds:text-body-sm sgds:leading-2-xs sgds:tracking-normal sgds:text-body-subtle">{selected.streetName}<br />{selected.town}</p>
              </div>
              <SgdsIconButton name="close" variant="ghost" tone="neutral" ariaLabel="Close recent transactions" onClick={() => setSelected(null)} />
            </div>
            <div className="sgds:flex sgds:flex-col sgds:gap-text-xs sgds:my-component-md sgds:py-component-xs sgds:border-y sgds:border-default">
              <div className="sgds:text-overline-md sgds:font-semibold sgds:leading-2-xs sgds:tracking-wide sgds:uppercase sgds:text-body-subtle">Median price per sq ft</div>
              <div className="sgds:text-display-sm sgds:font-bold sgds:leading-xl sgds:tracking-tighter sgds:text-heading-default">${Math.round(toPsf(selected.medianPsm)).toLocaleString()}</div>
              <div className="sgds:text-caption-md sgds:leading-2-xs sgds:tracking-normal sgds:text-body-subtle">From {selected.transactionCount} matching sales</div>
            </div>
            <div className="sgds:grid sgds:grid-cols-2 sgds:gap-component-sm">
              <div className="sgds:flex sgds:flex-col sgds:gap-text-2-xs sgds:border-l-4 sgds:border-primary-default sgds:pl-3"><div className="sgds:text-label-sm sgds:leading-2-xs sgds:text-body-subtle">Median sale</div><div className="sgds:text-subtitle-sm sgds:font-semibold sgds:leading-2-xs sgds:text-heading-default">{currency.format(selected.medianPrice)}</div></div>
              <div className="sgds:flex sgds:flex-col sgds:gap-text-2-xs sgds:border-l-4 sgds:border-primary-default sgds:pl-3"><div className="sgds:text-label-sm sgds:leading-2-xs sgds:text-body-subtle">Sales shown</div><div className="sgds:text-subtitle-sm sgds:font-semibold sgds:leading-2-xs sgds:text-heading-default">{transactions?.length ?? "…"} recent</div></div>
            </div>
            <div className="sgds:flex sgds:justify-between sgds:mt-component-md sgds:mb-component-xs sgds:text-overline-md sgds:font-semibold sgds:leading-2-xs sgds:tracking-wide sgds:uppercase sgds:text-body-subtle"><span>Recent sales</span><span>Price</span></div>
            <div>{transactions ? transactions.map((sale) => <article className="sgds:flex sgds:justify-between sgds:gap-component-xs sgds:py-component-xs sgds:border-t sgds:border-default" key={`${sale.month}-${sale.resalePrice}`}><div><div className="sgds:text-label-md sgds:font-semibold sgds:leading-xs sgds:text-heading-default">{sale.month}</div><div className="sgds:text-caption-md sgds:leading-2-xs sgds:text-body-subtle">{sale.flatType} · {Math.round(toSqft(sale.floorAreaSqm)).toLocaleString()} sq ft · {sale.storeyRange}</div></div><div className="sgds:text-right"><div className="sgds:text-label-md sgds:font-semibold sgds:leading-xs sgds:text-heading-default">{currency.format(sale.resalePrice)}</div><div className="sgds:text-caption-md sgds:leading-2-xs sgds:text-body-subtle">${Math.round(toPsf(sale.resalePrice / sale.floorAreaSqm)).toLocaleString()}/sq ft</div></div></article>) : <div className="sgds:flex sgds:items-center sgds:gap-component-xs sgds:py-component-xs"><SgdsSpinner size="sm" label="Loading transactions" /><span className="sgds:text-body-sm sgds:leading-2-xs sgds:text-body-subtle">Loading transactions…</span></div>}</div>
            <p className="sgds:text-caption-md sgds:leading-2-xs sgds:tracking-normal sgds:text-body-subtle sgds:mt-component-md">Indicative resale evidence, not a valuation. Individual homes differ by condition, floor, lease, and more.</p>
            </aside>
          </>}
        </section>
    </main>
  );
}
