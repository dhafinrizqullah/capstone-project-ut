-- Fix RLS recursion: public.my_role() reads profiles, but policy
-- profiles_select_staff calls my_role() -> loop until stack overflow (54001).
-- Fix per the skill checklist: DEFINER function in a non-exposed schema + auth.uid()
-- check in the function body + EXECUTE for authenticated only.

create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;

create or replace function internal.my_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = (select auth.uid()) $$;

revoke all on function internal.my_role() from public, anon, authenticated;
grant execute on function internal.my_role() to authenticated;

-- Point every policy at internal.my_role()
drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff" on public.profiles for select
  to authenticated using (internal.my_role() in ('petugas', 'pengurus_rw', 'superadmin'));

drop policy if exists "deposits_select_staff" on public.deposits;
create policy "deposits_select_staff" on public.deposits for select
  to authenticated using (internal.my_role() in ('petugas', 'pengurus_rw'));
drop policy if exists "deposits_insert_petugas" on public.deposits;
create policy "deposits_insert_petugas" on public.deposits for insert
  to authenticated with check (internal.my_role() = 'petugas');
drop policy if exists "deposits_update_petugas" on public.deposits;
create policy "deposits_update_petugas" on public.deposits for update
  to authenticated
  using (internal.my_role() = 'petugas')
  with check (internal.my_role() = 'petugas');

drop policy if exists "deposit_items_select_staff" on public.deposit_items;
create policy "deposit_items_select_staff" on public.deposit_items for select
  to authenticated using (internal.my_role() in ('petugas', 'pengurus_rw'));
drop policy if exists "deposit_items_insert_petugas" on public.deposit_items;
create policy "deposit_items_insert_petugas" on public.deposit_items for insert
  to authenticated with check (internal.my_role() = 'petugas');

drop policy if exists "ledger_select_staff" on public.savings_ledger;
create policy "ledger_select_staff" on public.savings_ledger for select
  to authenticated using (internal.my_role() in ('petugas', 'pengurus_rw'));
drop policy if exists "ledger_insert_petugas" on public.savings_ledger;
create policy "ledger_insert_petugas" on public.savings_ledger for insert
  to authenticated with check (internal.my_role() = 'petugas');

drop policy if exists "withdrawals_select_staff" on public.withdrawals;
create policy "withdrawals_select_staff" on public.withdrawals for select
  to authenticated using (internal.my_role() in ('petugas', 'pengurus_rw'));
drop policy if exists "withdrawals_update_petugas" on public.withdrawals;
create policy "withdrawals_update_petugas" on public.withdrawals for update
  to authenticated
  using (internal.my_role() = 'petugas')
  with check (internal.my_role() = 'petugas');

drop policy if exists "shipments_select" on public.shipments;
create policy "shipments_select" on public.shipments for select
  to authenticated using (
    collector_id = (select auth.uid())
    or internal.my_role() in ('petugas', 'pengurus_rw')
  );
drop policy if exists "shipments_insert_petugas" on public.shipments;
create policy "shipments_insert_petugas" on public.shipments for insert
  to authenticated with check (internal.my_role() = 'petugas');
drop policy if exists "shipments_update" on public.shipments;
create policy "shipments_update" on public.shipments for update
  to authenticated
  using (
    internal.my_role() = 'petugas'
    or (collector_id = (select auth.uid()) and internal.my_role() = 'pengepul')
  )
  with check (
    internal.my_role() = 'petugas'
    or (collector_id = (select auth.uid()) and internal.my_role() = 'pengepul')
  );

drop policy if exists "shipment_items_select" on public.shipment_items;
create policy "shipment_items_select" on public.shipment_items for select
  to authenticated using (
    exists (
      select 1 from public.shipments s
      where s.id = shipment_id
        and (s.collector_id = (select auth.uid()) or internal.my_role() in ('petugas', 'pengurus_rw'))
    )
  );
drop policy if exists "shipment_items_insert_petugas" on public.shipment_items;
create policy "shipment_items_insert_petugas" on public.shipment_items for insert
  to authenticated with check (internal.my_role() = 'petugas');

drop policy if exists "categories_insert_staff" on public.waste_categories;
create policy "categories_insert_staff" on public.waste_categories for insert
  to authenticated with check (internal.my_role() in ('petugas', 'pengurus_rw'));
drop policy if exists "categories_update_staff" on public.waste_categories;
create policy "categories_update_staff" on public.waste_categories for update
  to authenticated
  using (internal.my_role() in ('petugas', 'pengurus_rw'))
  with check (internal.my_role() in ('petugas', 'pengurus_rw'));
drop policy if exists "categories_delete_staff" on public.waste_categories;
create policy "categories_delete_staff" on public.waste_categories for delete
  to authenticated using (internal.my_role() = 'pengurus_rw');

-- Drop the old recursion-triggering function
drop function if exists public.my_role();
