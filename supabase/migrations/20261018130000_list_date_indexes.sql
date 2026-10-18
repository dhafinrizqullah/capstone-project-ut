-- Date-window pagination: every list page now pages in the database and narrows by
-- a Jakarta date range (see app/composables/useDateRange.ts — the window is sent as
-- a UTC instant, so `timestamptz` compares directly). These indexes keep the range
-- scans off a full table read.
--
-- Already covered by 20261017120307_query_indexes.sql:
--   deposits  (status, deposited_at desc)      dashboard + report (status tercatat + window)
--   withdrawals (status, created_at desc)      payout page when a status is picked
--   shipments (collector_id, shipped_at desc)  handover (collector-scoped)

-- Resident weighing history: own rows, all statuses, newest first.
create index if not exists deposits_resident_date_idx
  on public.deposits (resident_id, deposited_at desc);

-- Resident withdrawal history: own requests newest-first.
create index if not exists withdrawals_resident_date_idx
  on public.withdrawals (resident_id, created_at desc);

-- Payout page with the "all" status pick: window alone, no status prefix.
create index if not exists withdrawals_date_idx
  on public.withdrawals (created_at desc);

-- Shipment history across collectors (the cashier page is not collector-scoped).
create index if not exists shipments_date_idx
  on public.shipments (shipped_at desc);
