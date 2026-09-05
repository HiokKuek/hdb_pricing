-- Some managed Postgres clients enable safe-delete protection. Keep the
-- rebuild explicit while retaining the existing security-invoker boundary.
create or replace function public.refresh_hdb_block_summaries()
returns void language sql security invoker set search_path = public as $$
  delete from public.hdb_block_summaries where block_id is not null;
  insert into public.hdb_block_summaries (block_id, block, street_name, town, flat_type, latitude, longitude, median_psm, median_price, transaction_count, transactions)
  select concat(t.block, '|', t.street_name, '|', t.flat_type), t.block, t.street_name, min(t.town), t.flat_type, c.latitude, c.longitude,
    percentile_cont(.5) within group (order by t.resale_price / t.floor_area_sqm),
    percentile_cont(.5) within group (order by t.resale_price), count(*),
    jsonb_agg(jsonb_build_object('month', to_char(t.month,'YYYY-MM'), 'flatType',t.flat_type,'floorAreaSqm',t.floor_area_sqm,'storeyRange',t.storey_range,'leaseCommenceYear',t.lease_commence_year,'resalePrice',t.resale_price) order by t.month desc)
  from public.hdb_transactions t join public.hdb_block_coordinates c using (block, street_name)
  where t.month >= (select max(month) - interval '11 months' from public.hdb_transactions)
  group by t.block, t.street_name, t.flat_type, c.latitude, c.longitude;
$$;

revoke execute on function public.refresh_hdb_block_summaries() from public;
grant execute on function public.refresh_hdb_block_summaries() to service_role;
