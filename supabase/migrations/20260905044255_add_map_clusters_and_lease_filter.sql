alter table public.hdb_block_summaries
  add column if not exists median_lease_commence_year integer;

create index if not exists hdb_block_summaries_coordinates_idx
  on public.hdb_block_summaries (latitude, longitude);

create index if not exists hdb_block_summaries_flat_type_coordinates_idx
  on public.hdb_block_summaries (flat_type, latitude, longitude);

create or replace function public.refresh_hdb_block_summaries()
returns void language sql security invoker set search_path = public as $$
  delete from public.hdb_block_summaries where block_id is not null;
  insert into public.hdb_block_summaries (
    block_id,
    block,
    street_name,
    town,
    flat_type,
    latitude,
    longitude,
    median_psm,
    median_price,
    transaction_count,
    transactions,
    median_lease_commence_year
  )
  select
    concat(t.block, '|', t.street_name, '|', t.flat_type),
    t.block,
    t.street_name,
    min(t.town),
    t.flat_type,
    c.latitude,
    c.longitude,
    percentile_cont(.5) within group (order by t.resale_price / t.floor_area_sqm),
    percentile_cont(.5) within group (order by t.resale_price),
    count(*),
    jsonb_agg(jsonb_build_object(
      'month', to_char(t.month, 'YYYY-MM'),
      'flatType', t.flat_type,
      'floorAreaSqm', t.floor_area_sqm,
      'storeyRange', t.storey_range,
      'leaseCommenceYear', t.lease_commence_year,
      'resalePrice', t.resale_price
    ) order by t.month desc),
    round(percentile_cont(.5) within group (order by t.lease_commence_year))::integer
  from public.hdb_transactions t
  join public.hdb_block_coordinates c using (block, street_name)
  where t.month >= (select max(month) - interval '11 months' from public.hdb_transactions)
  group by t.block, t.street_name, t.flat_type, c.latitude, c.longitude;
$$;

select public.refresh_hdb_block_summaries();

alter table public.hdb_block_summaries
  alter column median_lease_commence_year set not null;

create or replace function public.get_hdb_map_markers(
  p_south numeric,
  p_west numeric,
  p_north numeric,
  p_east numeric,
  p_zoom integer,
  p_flat_type text default 'all',
  p_price_band text default 'any',
  p_lease_band text default 'any',
  p_reference_year integer default extract(year from current_date)::integer
)
returns table (
  marker_kind text,
  marker_id text,
  latitude numeric,
  longitude numeric,
  block text,
  street_name text,
  town text,
  flat_type text,
  median_psm numeric,
  median_price numeric,
  transaction_count integer,
  cluster_count integer,
  under_560_count integer,
  from_560_to_650_count integer,
  from_650_to_745_count integer,
  above_745_count integer
)
language sql
security invoker
set search_path = public
stable
as $$
  with settings as (
    select case
      when p_zoom <= 11 then 0.03::numeric
      when p_zoom <= 13 then 0.012::numeric
      when p_zoom <= 14 then 0.004::numeric
      else null
    end as cell_size
  ),
  filtered as (
    select summary.*,
      summary.median_psm * 0.09290304 as median_psf,
      99 - (p_reference_year - summary.median_lease_commence_year) as remaining_lease_years
    from public.hdb_block_summaries summary
    where summary.latitude between p_south and p_north
      and summary.longitude between p_west and p_east
      and (p_flat_type = 'all' or summary.flat_type = p_flat_type)
      and (
        p_price_band = 'any'
        or (p_price_band = 'under-650' and summary.median_price < 650000)
        or (p_price_band = '650-850' and summary.median_price >= 650000 and summary.median_price < 850000)
        or (p_price_band = '850-plus' and summary.median_price >= 850000)
      )
      and (
        p_lease_band = 'any'
        or (p_lease_band = '80-plus' and 99 - (p_reference_year - summary.median_lease_commence_year) >= 80)
        or (p_lease_band = '70-79' and 99 - (p_reference_year - summary.median_lease_commence_year) between 70 and 79)
        or (p_lease_band = '60-69' and 99 - (p_reference_year - summary.median_lease_commence_year) between 60 and 69)
        or (p_lease_band = 'under-60' and 99 - (p_reference_year - summary.median_lease_commence_year) < 60)
      )
  ),
  clusters as (
    select
      floor(filtered.latitude / settings.cell_size) * settings.cell_size as cell_latitude,
      floor(filtered.longitude / settings.cell_size) * settings.cell_size as cell_longitude,
      avg(filtered.latitude) as latitude,
      avg(filtered.longitude) as longitude,
      count(*)::integer as cluster_count,
      count(*) filter (where filtered.median_psf < 560)::integer as under_560_count,
      count(*) filter (where filtered.median_psf >= 560 and filtered.median_psf < 650)::integer as from_560_to_650_count,
      count(*) filter (where filtered.median_psf >= 650 and filtered.median_psf < 745)::integer as from_650_to_745_count,
      count(*) filter (where filtered.median_psf >= 745)::integer as above_745_count
    from filtered
    cross join settings
    where settings.cell_size is not null
    group by cell_latitude, cell_longitude
  )
  select
    'cluster'::text,
    concat('cluster:', cell_latitude, ':', cell_longitude),
    clusters.latitude,
    clusters.longitude,
    null::text,
    null::text,
    null::text,
    null::text,
    null::numeric,
    null::numeric,
    null::integer,
    clusters.cluster_count,
    clusters.under_560_count,
    clusters.from_560_to_650_count,
    clusters.from_650_to_745_count,
    clusters.above_745_count
  from clusters
  union all
  select
    'block'::text,
    filtered.block_id,
    filtered.latitude,
    filtered.longitude,
    filtered.block,
    filtered.street_name,
    filtered.town,
    filtered.flat_type,
    filtered.median_psm,
    filtered.median_price,
    filtered.transaction_count,
    null::integer,
    null::integer,
    null::integer,
    null::integer,
    null::integer
  from filtered
  cross join settings
  where settings.cell_size is null;
$$;

revoke execute on function public.get_hdb_map_markers(numeric, numeric, numeric, numeric, integer, text, text, text, integer) from public;
revoke execute on function public.get_hdb_map_markers(numeric, numeric, numeric, numeric, integer, text, text, text, integer) from anon;
revoke execute on function public.get_hdb_map_markers(numeric, numeric, numeric, numeric, integer, text, text, text, integer) from authenticated;
grant execute on function public.get_hdb_map_markers(numeric, numeric, numeric, numeric, integer, text, text, text, integer) to service_role;
