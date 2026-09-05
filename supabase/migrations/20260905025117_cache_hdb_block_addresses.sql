create table if not exists public.hdb_block_addresses (
  block text not null,
  street_name text not null,
  town text not null,
  primary key (block, street_name)
);

alter table public.hdb_block_addresses enable row level security;
grant select, insert, update, delete on public.hdb_block_addresses to service_role;

insert into public.hdb_block_addresses (block, street_name, town)
select block, street_name, min(town)
from public.hdb_transactions
group by block, street_name
on conflict (block, street_name) do update set town = excluded.town;

insert into public.hdb_app_metadata (key, value)
select 'transactions_through', to_char(max(month), 'YYYY-MM')
from public.hdb_transactions
having max(month) is not null
on conflict (key) do update set value = excluded.value;
