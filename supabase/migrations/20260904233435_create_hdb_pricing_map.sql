create table if not exists public.hdb_transactions (
  transaction_key text primary key,
  month date not null,
  town text not null,
  flat_type text not null,
  block text not null,
  street_name text not null,
  storey_range text not null,
  floor_area_sqm numeric not null,
  lease_commence_year integer not null,
  resale_price numeric not null
);

create index if not exists hdb_transactions_month_idx on public.hdb_transactions (month);
create index if not exists hdb_transactions_block_street_idx on public.hdb_transactions (block, street_name);

create table if not exists public.hdb_block_coordinates (
  block text not null,
  street_name text not null,
  latitude numeric not null,
  longitude numeric not null,
  primary key (block, street_name)
);

create table if not exists public.hdb_block_summaries (
  block_id text primary key,
  block text not null,
  street_name text not null,
  town text not null,
  flat_type text not null,
  latitude numeric not null,
  longitude numeric not null,
  median_psm numeric not null,
  median_price numeric not null,
  transaction_count integer not null,
  transactions jsonb not null
);

create index if not exists hdb_block_summaries_flat_type_psm_idx on public.hdb_block_summaries (flat_type, median_psm);

create table if not exists public.hdb_app_metadata (
  key text primary key,
  value text not null
);

alter table public.hdb_transactions enable row level security;
alter table public.hdb_block_coordinates enable row level security;
alter table public.hdb_block_summaries enable row level security;
alter table public.hdb_app_metadata enable row level security;

create or replace function public.refresh_hdb_block_summaries()
returns void language sql security invoker set search_path = public as $$
  delete from hdb_block_summaries;
  insert into hdb_block_summaries (block_id, block, street_name, town, flat_type, latitude, longitude, median_psm, median_price, transaction_count, transactions)
  select concat(t.block, '|', t.street_name, '|', t.flat_type), t.block, t.street_name, min(t.town), t.flat_type, c.latitude, c.longitude,
    percentile_cont(.5) within group (order by t.resale_price / t.floor_area_sqm),
    percentile_cont(.5) within group (order by t.resale_price), count(*),
    jsonb_agg(jsonb_build_object('month', to_char(t.month,'YYYY-MM'), 'flatType',t.flat_type,'floorAreaSqm',t.floor_area_sqm,'storeyRange',t.storey_range,'leaseCommenceYear',t.lease_commence_year,'resalePrice',t.resale_price) order by t.month desc)
  from hdb_transactions t join hdb_block_coordinates c using (block, street_name)
  where t.month >= (select max(month) - interval '11 months' from hdb_transactions)
  group by t.block, t.street_name, t.flat_type, c.latitude, c.longitude;
$$;

revoke execute on function public.refresh_hdb_block_summaries() from public;
grant execute on function public.refresh_hdb_block_summaries() to service_role;
