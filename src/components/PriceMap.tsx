"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  SgdsButton,
  SgdsDivider,
  SgdsIcon,
  SgdsIconButton,
  SgdsInput,
  SgdsLink,
  SgdsSelect,
  SgdsSpinner,
  SgdsToast,
  SgdsToastContainer,
} from "@govtechsg/sgds-web-component/react";
import type { BlockSummary, MapFilters, MapMarker, Transaction } from "@/lib/types";
import type { MapBounds } from "@/lib/blocks";
import { MAP_COLOUR_SCALE } from "@/lib/map-colour-scale.generated";
import { toPsf, toSqft } from "@/lib/pricing";

const MapCanvas = dynamic(() => import("./MapCanvas"), { ssr: false, loading: () => <div className="map-loading">Drawing the field map…</div> });

const currency = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 });
type Place = { address: string; latitude: number; longitude: number };
type ValueElement = HTMLElement & { value: string };
type Viewport = { bounds: MapBounds; zoom: number };

function compactAddress(address: string) {
  return address.length > 54 ? `${address.slice(0, 51)}…` : address;
}

function MapSelectOption({ value, children }: { value: string; children: ReactNode }) {
  // SGDS upgrades this custom element before React hydrates and adds ARIA
  // attributes. Its value must be an HTML attribute at first paint.
  return <sgds-select-option value={value} suppressHydrationWarning>{children}</sgds-select-option>;
}

export default function PriceMap({ initialMarkers, flatTypes, initialFilters, initialBounds, initialZoom }: { initialMarkers: MapMarker[]; flatTypes: string[]; initialFilters: MapFilters; initialBounds: MapBounds; initialZoom: number }) {
  const [markers, setMarkers] = useState(initialMarkers);
  const [flatType, setFlatType] = useState(initialFilters.flatType);
  const [selected, setSelected] = useState<BlockSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [loadingMarkers, setLoadingMarkers] = useState(false);
  const [showMapUpdate, setShowMapUpdate] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ bounds: initialBounds, zoom: initialZoom });
  const [budget, setBudget] = useState<MapFilters["priceBand"]>(initialFilters.priceBand);
  const [leaseBand, setLeaseBand] = useState<MapFilters["leaseBand"]>(initialFilters.leaseBand);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeSearchState, setPlaceSearchState] = useState<"idle" | "loading" | "complete">("idle");
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDrawerMounted, setMobileDrawerMounted] = useState(false);
  const [draftFlatType, setDraftFlatType] = useState(initialFilters.flatType);
  const [draftBudget, setDraftBudget] = useState<MapFilters["priceBand"]>(initialFilters.priceBand);
  const [draftLeaseBand, setDraftLeaseBand] = useState<MapFilters["leaseBand"]>(initialFilters.leaseBand);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [showEmptyViewToast, setShowEmptyViewToast] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const detailSheetRef = useRef<HTMLDivElement>(null);
  const detailSheetDragRef = useRef<{ startY: number } | null>(null);
  const selectedPlaceQueryRef = useRef<string | null>(null);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (selectedPlaceQueryRef.current === query) {
      selectedPlaceQueryRef.current = null;
      setPlaces([]);
      setPlaceSearchState("idle");
      return;
    }
    if (trimmedQuery.length < 3) {
      setPlaces([]);
      setPlaceSearchState("idle");
      return;
    }
    const controller = new AbortController();
    setPlaces([]);
    setPlaceSearchState("loading");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/place-search?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal });
        if (response.ok) setPlaces((await response.json()).results);
        else setPlaces([]);
      } catch {
        if (!controller.signal.aborted) setPlaces([]);
      } finally {
        if (!controller.signal.aborted) setPlaceSearchState("complete");
      }
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsCompactViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileDrawerMounted) return;
    const frame = window.requestAnimationFrame(() => setMobileMenuOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [mobileDrawerMounted]);

  useEffect(() => {
    if (!loadingMarkers) {
      setShowMapUpdate(false);
      return;
    }
    const timer = window.setTimeout(() => setShowMapUpdate(true), 250);
    return () => window.clearTimeout(timer);
  }, [loadingMarkers]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!selected || !isCompactViewport) {
      setDetailSheetOpen(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setDetailSheetOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [isCompactViewport, selected]);

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
      .then((data: { markers: MapMarker[] }) => {
        if (controller.signal.aborted) return;
        setMarkers(data.markers);
        setShowEmptyViewToast(data.markers.length === 0 && (flatType !== "all" || budget !== "any" || leaseBand !== "any"));
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setMarkers([]);
          setShowEmptyViewToast(false);
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingMarkers(false); });
    return () => controller.abort();
  }, [viewport, flatType, budget, leaseBand]);

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
    clearTransactionDetail();
    setFocus([place.latitude, place.longitude]);
    selectedPlaceQueryRef.current = place.address;
    setQuery(place.address);
    setPlaces([]);
    setPlaceSearchState("idle");
    if (mobileMenuOpen) closeMobileMenu();
  }

  function selectFirstPlace() {
    if (places[0]) selectPlace(places[0]);
  }

  function submitPlaceSearch(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || !places[0]) return;
    event.preventDefault();
    selectFirstPlace();
  }

  function getSelectValue(event: Event) {
    return (event.target as ValueElement).value;
  }

  function clearTransactionDetail() {
    setSelected(null);
    setTransactions(null);
  }

  function updateFlatType(event: Event) {
    clearTransactionDetail();
    setFlatType(getSelectValue(event));
  }

  function updatePriceBand(event: Event) {
    clearTransactionDetail();
    setBudget(getSelectValue(event) as MapFilters["priceBand"]);
  }

  function updateLeaseBand(event: Event) {
    clearTransactionDetail();
    setLeaseBand(getSelectValue(event) as MapFilters["leaseBand"]);
  }

  function openMobileMenu() {
    setDraftFlatType(flatType);
    setDraftBudget(budget);
    setDraftLeaseBand(leaseBand);
    setMobileDrawerMounted(true);
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
    window.setTimeout(unmountMobileDrawer, 300);
  }

  function unmountMobileDrawer() {
    setMobileDrawerMounted(false);
  }

  function applyMobileFilters() {
    clearTransactionDetail();
    setFlatType(draftFlatType);
    setBudget(draftBudget);
    setLeaseBand(draftLeaseBand);
    closeMobileMenu();
  }

  function closeDetailSheet() {
    detailSheetRef.current?.style.setProperty("--map-detail-sheet-offset", "0px");
    detailSheetRef.current?.classList.remove("map-detail-sheet--dragging");
    setDetailSheetOpen(false);
  }

  function startDetailSheetDrag(event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    detailSheetDragRef.current = { startY: event.clientY };
    detailSheetRef.current?.classList.add("map-detail-sheet--dragging");
  }

  function moveDetailSheetDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = detailSheetDragRef.current;
    if (!drag) return;
    const offset = Math.max(0, event.clientY - drag.startY);
    detailSheetRef.current?.style.setProperty("--map-detail-sheet-offset", `${offset}px`);
  }

  function endDetailSheetDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = detailSheetDragRef.current;
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const offset = Math.max(0, event.clientY - drag.startY);
    detailSheetDragRef.current = null;
    detailSheetRef.current?.classList.remove("map-detail-sheet--dragging");
    if (offset > 120) closeDetailSheet();
    else detailSheetRef.current?.style.setProperty("--map-detail-sheet-offset", "0px");
  }

  return (
    <main className="map-app-shell sgds:relative sgds:overflow-hidden" aria-label="HDB resale price map">
        <div className="sgds:absolute sgds:inset-0"><MapCanvas markers={markers} selectedId={selected?.id ?? null} focus={focus} onSelect={selectBlock} onViewportChange={updateViewport} initialZoom={initialZoom} /></div>
        <section className="sgds:absolute sgds:inset-0 sgds:z-800 sgds:pointer-events-none" aria-label="Map controls and resale evidence">
          <div className="map-controls sgds:pointer-events-auto sgds:absolute sgds:left-1/2 sgds:w-[calc(100%-2rem)] sgds:lg:w-[calc(100%-3rem)] sgds:-translate-x-1/2">
            <div className="sgds:hidden sgds:lg:grid sgds:lg:grid-cols-[13rem_minmax(14rem,1fr)_repeat(3,9rem)] sgds:2-xl:grid-cols-[18rem_minmax(14rem,1fr)_repeat(3,9rem)] sgds:lg:items-end sgds:lg:gap-component-xs">
              <header>
                <h1 className="sgds:text-heading-sm sgds:font-semibold sgds:leading-sm sgds:tracking-tight sgds:text-heading-default">HDB Resale Prices</h1>
                <p className="sgds:mt-text-2-xs sgds:text-body-sm sgds:font-regular sgds:leading-2-xs sgds:tracking-normal sgds:text-body-subtle">Distribution of HDB resale prices across Singapore</p>
              </header>
              <div className="sgds:relative sgds:lg:self-center">
                <SgdsInput
                  type="text"
                  aria-label="Search for a place"
                  name="place-search"
                  value={query}
                  onSgdsInput={(event) => setQuery((event.target as ValueElement).value)}
                  onKeyDown={submitPlaceSearch}
                  placeholder="Search block, street or town"
                />
                <SgdsIconButton
                  className="map-search-action sgds:absolute sgds:right-2 sgds:top-1/2 sgds:-translate-y-1/2"
                  name="search"
                  variant="ghost"
                  ariaLabel="Show the first matching HDB location"
                  disabled={places.length === 0}
                  onClick={selectFirstPlace}
                />
                {placeSearchState === "loading" && <div className="place-search-menu" aria-live="polite"><div className="place-search-status"><SgdsSpinner size="xs" label="Finding places" orientation="horizontal" />Finding places…</div></div>}
                {placeSearchState === "complete" && places.length > 0 && <div className="place-search-menu" role="listbox" aria-label="Place search results">
                  {places.map((place) => <button className="place-search-result" key={`${place.latitude}-${place.longitude}`} type="button" role="option" aria-label={place.address} onClick={() => selectPlace(place)}>{compactAddress(place.address)}</button>)}
                </div>}
                {placeSearchState === "complete" && places.length === 0 && <div className="place-search-menu" aria-live="polite"><div className="place-search-status">No places found</div></div>}
              </div>
              <div className="sgds:lg:self-center sgds:lg:-translate-y-4">
                <SgdsSelect label="Flat type" name="flat-type" value={flatType} placeholder="All flat types" onSgdsChange={updateFlatType}>
                  <MapSelectOption value="all">All flat types</MapSelectOption>
                  {flatTypes.map((type) => <MapSelectOption key={type} value={type}>{type}</MapSelectOption>)}
                </SgdsSelect>
              </div>
              <div className="sgds:lg:self-center sgds:lg:-translate-y-4">
                <SgdsSelect label="Price" name="price" value={budget} placeholder="Any price" onSgdsChange={updatePriceBand}>
                  <MapSelectOption value="any">Any price</MapSelectOption>
                  <MapSelectOption value="under-650">Under $650k</MapSelectOption>
                  <MapSelectOption value="650-850">$650k–850k</MapSelectOption>
                  <MapSelectOption value="850-plus">$850k+</MapSelectOption>
                </SgdsSelect>
              </div>
              <div className="sgds:lg:self-center sgds:lg:-translate-y-4">
                <SgdsSelect label="Lease remaining" name="lease" value={leaseBand} placeholder="Any lease" onSgdsChange={updateLeaseBand}>
                  <MapSelectOption value="any">Any lease</MapSelectOption>
                  <MapSelectOption value="80-plus">80+ years</MapSelectOption>
                  <MapSelectOption value="70-79">70–79 years</MapSelectOption>
                  <MapSelectOption value="60-69">60–69 years</MapSelectOption>
                  <MapSelectOption value="under-60">Under 60 years</MapSelectOption>
                </SgdsSelect>
              </div>
            </div>
            <div className="sgds:pt-layout-xs sgds:lg:pt-0 sgds:lg:hidden">
              <header>
                <h1 className="sgds:text-heading-sm sgds:font-semibold sgds:leading-sm sgds:tracking-tight sgds:text-heading-default">HDB Resale Prices</h1>
                <p className="sgds:mt-text-2-xs sgds:relative sgds:top-1 sgds:text-body-sm sgds:font-regular sgds:leading-2-xs sgds:tracking-normal sgds:text-body-subtle">Distribution of HDB resale prices across Singapore</p>
              </header>
            </div>
          </div>
          <button
            type="button"
            className={`map-menu-toggle sgds:pointer-events-auto sgds:lg:hidden${mobileMenuOpen ? " map-menu-toggle--open" : ""}`}
            aria-label={mobileMenuOpen ? "Close map menu" : "Open map menu"}
            onClick={() => mobileMenuOpen ? closeMobileMenu() : openMobileMenu()}
          >
            <span className="map-menu-toggle-bar" />
            {mobileMenuOpen ? <span className="map-menu-toggle-spacer" aria-hidden="true" /> : <span className="map-menu-toggle-bar" />}
            <span className="map-menu-toggle-bar" />
          </button>
          {mobileDrawerMounted && <div className={`map-options-drawer-layer sgds:pointer-events-auto sgds:lg:hidden${mobileMenuOpen ? " map-options-drawer-layer--open" : ""}`}>
            <button className="map-options-drawer-backdrop" aria-label="Close map options" onClick={closeMobileMenu} />
            <aside className="map-options-drawer" role="dialog" aria-modal="true" aria-label="Map search and filters" onTransitionEnd={(event) => { if (event.target === event.currentTarget && !mobileMenuOpen) unmountMobileDrawer(); }}>
              <header className="map-options-drawer-header">
                <h2 className="sgds:text-heading-lg sgds:font-bold sgds:leading-lg sgds:tracking-tight sgds:text-heading-default">Map options</h2>
                <p className="sgds:mt-text-md sgds:text-body-lg sgds:leading-sm sgds:text-body-subtle">Search for a place or refine the resale prices shown on the map.</p>
              </header>
              <div className="sgds:flex sgds:flex-col sgds:gap-component-md sgds:mt-component-lg">
                <section aria-labelledby="mobile-place-search-heading">
                  <h3 id="mobile-place-search-heading" className="sgds:text-subtitle-sm sgds:font-semibold sgds:leading-xs sgds:tracking-normal sgds:text-heading-default">Search</h3>
                  <div className="sgds:relative sgds:mt-text-xs">
                    <SgdsInput type="text" aria-label="Search for a place" name="place-search-mobile" value={query} onSgdsInput={(event) => setQuery((event.target as ValueElement).value)} onKeyDown={submitPlaceSearch} placeholder="Search block, street or town" />
                    {placeSearchState === "loading" && <div className="place-search-menu" aria-live="polite"><div className="place-search-status"><SgdsSpinner size="xs" label="Finding places" orientation="horizontal" />Finding places…</div></div>}
                    {placeSearchState === "complete" && places.length > 0 && <div className="place-search-menu" role="listbox" aria-label="Place search results">
                      {places.map((place) => <button className="place-search-result" key={`${place.latitude}-${place.longitude}`} type="button" role="option" aria-label={place.address} onClick={() => selectPlace(place)}>{compactAddress(place.address)}</button>)}
                    </div>}
                    {placeSearchState === "complete" && places.length === 0 && <div className="place-search-menu" aria-live="polite"><div className="place-search-status">No places found</div></div>}
                  </div>
                </section>
                <SgdsDivider />
              <label className="mobile-filter-label">Flat type<select className="mobile-filter-select" name="mobile-flat-type" value={draftFlatType} onChange={(event) => setDraftFlatType(event.target.value)}><option value="all">All flat types</option>{flatTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <label className="mobile-filter-label">Price<select className="mobile-filter-select" name="mobile-price" value={draftBudget} onChange={(event) => setDraftBudget(event.target.value as MapFilters["priceBand"])}><option value="any">Any price</option><option value="under-650">Under $650k</option><option value="650-850">$650k–850k</option><option value="850-plus">$850k+</option></select></label>
              <label className="mobile-filter-label">Lease remaining<select className="mobile-filter-select" name="mobile-lease" value={draftLeaseBand} onChange={(event) => setDraftLeaseBand(event.target.value as MapFilters["leaseBand"])}><option value="any">Any lease</option><option value="80-plus">80+ years</option><option value="70-79">70–79 years</option><option value="60-69">60–69 years</option><option value="under-60">Under 60 years</option></select></label>
              </div>
              <div className="sgds:mt-component-lg"><SgdsButton variant="outline" tone="neutral" ariaLabel="Apply filters" onClick={applyMobileFilters}>Apply filters</SgdsButton></div>
            </aside>
          </div>}
          {showMapUpdate && <div className="sgds:pointer-events-none sgds:absolute sgds:z-800 sgds:right-3 sgds:bottom-40 sgds:lg:right-4 sgds:lg:bottom-4 sgds:flex sgds:items-center sgds:gap-text-2-xs sgds:bg-surface-raised sgds:border sgds:border-default sgds:rounded-md sgds:shadow-lg sgds:px-3 sgds:py-2" role="status">
            <SgdsSpinner size="xs" tone="neutral" label="Updating map" orientation="horizontal" />
          </div>}
          <aside className="map-legend sgds:pointer-events-auto sgds:absolute sgds:left-3 sgds:right-3 sgds:grid sgds:grid-cols-2 sgds:gap-x-3 sgds:gap-y-2 sgds:bg-surface-raised sgds:border sgds:border-default sgds:rounded-lg sgds:shadow-lg sgds:p-3 sgds:lg:right-auto sgds:lg:flex sgds:lg:flex-wrap sgds:lg:items-center sgds:lg:gap-component-xs sgds:lg:p-component-xs" aria-label="Price per square foot legend">
            <div className="sgds:col-span-2 sgds:shrink-0 sgds:text-overline-md sgds:font-semibold sgds:leading-2-xs sgds:tracking-wide sgds:uppercase sgds:text-body-subtle sgds:lg:col-auto">Price per sq ft</div>
            {MAP_COLOUR_SCALE.map((band) => <div className="sgds:flex sgds:min-w-0 sgds:items-center sgds:gap-text-2-xs" key={band.id}><span className={`map-legend-swatch map-colour-scale-${band.id}`} aria-hidden="true" /><span className="sgds:text-label-sm sgds:font-regular sgds:leading-2-xs sgds:tracking-normal sgds:text-body-default">{band.label}</span></div>)}
          </aside>

          {selected && <>
            {isCompactViewport && <div className={`map-detail-sheet-layer sgds:pointer-events-auto${detailSheetOpen ? " map-detail-sheet-layer--open" : ""}`}>
              <button className="map-detail-sheet-backdrop" aria-label="Close recent transactions" onClick={closeDetailSheet} />
              <div ref={detailSheetRef} className="map-detail-sheet" role="dialog" aria-modal="true" aria-label={`Recent transactions for Block ${selected.block}`} onTransitionEnd={(event) => { if (event.target === event.currentTarget && !detailSheetOpen) { setSelected(null); setTransactions(null); } }}>
                <button className="map-detail-sheet-handle" type="button" aria-label="Drag down to close recent transactions" onPointerDown={startDetailSheetDrag} onPointerMove={moveDetailSheetDrag} onPointerUp={endDetailSheetDrag} onPointerCancel={endDetailSheetDrag}><span /></button>
                <button className="map-detail-sheet-close" type="button" aria-label="Close recent transactions" onClick={closeDetailSheet}>×</button>
                <div className="map-detail-sheet-content" aria-live="polite">
                <h2 className="sgds:text-heading-lg sgds:font-bold sgds:leading-lg sgds:tracking-tight sgds:text-heading-default">Block {selected.block}</h2>
                <p className="sgds:text-body-sm sgds:leading-2-xs sgds:tracking-normal sgds:text-body-subtle sgds:mt-text-xs">{selected.streetName}, {selected.town}</p>
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
                <div className="sgds:mt-component-md"><SgdsLink size="sm" tone="neutral"><a href="https://data.gov.sg/collections/189/view" target="_blank" rel="noreferrer">Data from Housing Development Board</a></SgdsLink></div>
                </div>
              </div>
            </div>}
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
            <div className="sgds:mt-component-md"><SgdsLink size="sm" tone="neutral"><a href="https://data.gov.sg/collections/189/view" target="_blank" rel="noreferrer">Data from Housing Development Board</a></SgdsLink></div>
            </aside>
          </>}
        </section>
        <SgdsToastContainer className="map-empty-view-toast" position={isCompactViewport ? "bottom-center" : "bottom-end"}>
          <SgdsToast show={showEmptyViewToast} variant="info" title="No matching resale summaries" dismissible autohide delay={5000} onSgdsAfterHide={() => setShowEmptyViewToast(false)}>
            <SgdsIcon slot="icon" name="info-circle-fill" size="md" />
            No matching resale summaries in this area. Pan or search another location.
          </SgdsToast>
        </SgdsToastContainer>
    </main>
  );
}
