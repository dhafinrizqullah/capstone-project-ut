-- Warga may submit their own weighing request (self-declared weight). It stays
-- 'menunggu' and credits nothing until a petugas re-weighs it: verification writes
-- the final weight and only then does the deposit become 'tercatat' + credit savings.
--
-- Weight before/after: `estimated_weight` holds what the resident declared and is
-- never touched again (no update policy for warga); `total_weight` holds the final
-- re-weighed value. For now the UI only shows the final weight.

alter table public.deposits drop constraint if exists deposits_status_check;
alter table public.deposits
  add constraint deposits_status_check
  check (status in ('menunggu', 'tercatat', 'ditolak', 'dibatalkan'));

alter table public.deposits add column if not exists estimated_weight numeric(12, 3);
alter table public.deposits add column if not exists verified_by uuid references public.profiles (id);
alter table public.deposits add column if not exists verified_at timestamptz;

-- 1. Resident submits a request for their own profile, pending, nothing else.
create policy "deposits_insert_warga" on public.deposits for insert
  to authenticated with check (
    internal.my_role() = 'warga'
    and resident_id = (select auth.uid())
    and operator_id = (select auth.uid())
    and status = 'menunggu'
  );

-- Lines may only land on an own request that is still pending (so a verified
-- deposit can never gain extra lines).
create policy "deposit_items_insert_warga" on public.deposit_items for insert
  to authenticated with check (
    internal.my_role() = 'warga'
    and exists (
      select 1 from public.deposits d
      where d.id = deposit_id and d.resident_id = (select auth.uid()) and d.status = 'menunggu'
    )
  );

-- Own pending requests can be dropped again: the compensation path when the item
-- rows fail to insert, and the escape hatch for a request sent by mistake.
create policy "deposits_delete_warga_pending" on public.deposits for delete
  to authenticated using (
    internal.my_role() = 'warga'
    and resident_id = (select auth.uid())
    and status = 'menunggu'
  );

-- 2. Petugas re-weighs: corrects the line weights of a pending request.
create policy "deposit_items_update_petugas" on public.deposit_items for update
  to authenticated
  using (internal.my_role() = 'petugas')
  with check (internal.my_role() = 'petugas');

-- Verification queue reads pending rows oldest-first; the status+time index covers
-- mixed reads, this partial one keeps the queue scan off the recorded rows.
create index if not exists deposits_pending_time_idx
  on public.deposits (deposited_at) where status = 'menunggu';
