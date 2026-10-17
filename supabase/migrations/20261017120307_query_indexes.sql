-- Query-pattern indexes: composite + partial indexes matched to how the app
-- actually queries (dashboard aggregates, resident history, payout/shipment
-- lists, area suggestions). Replaces the plain resident FK index on the ledger
-- with a composite that also covers ordering.
drop index if exists public.ledger_resident_idx;
create index if not exists ledger_resident_time_idx
  on public.savings_ledger (resident_id, created_at desc);

-- Dashboard: all tercatat deposits newest-first
create index if not exists deposits_status_time_idx
  on public.deposits (status, deposited_at desc);

-- Resident history: own tercatat deposits newest-first (partial: only the
-- status this query ever asks for)
create index if not exists deposits_resident_time_idx
  on public.deposits (resident_id, deposited_at desc)
  where status = 'tercatat';

-- Payout validation list: by status, newest-first
create index if not exists withdrawals_status_time_idx
  on public.withdrawals (status, created_at desc);

-- Handover + shipment history: one collector's loads, newest-first
create index if not exists shipments_collector_time_idx
  on public.shipments (collector_id, shipped_at desc);

-- Category composition aggregates
create index if not exists deposit_items_category_idx
  on public.deposit_items (category_id);

-- Role listings (cashier resident picker, collector picker, area suggestions)
create index if not exists profiles_role_idx
  on public.profiles (role);

-- Price list: active categories by name
create index if not exists categories_active_name_idx
  on public.waste_categories (active, name);
