-- Superadmin can do everything other roles can: full row access on all
-- operational tables (checked via internal.my_role, no recursion risk).
-- User management itself stays behind the service-key Admin API, not RLS.

create policy "superadmin_all" on public.deposits for all
  to authenticated
  using (internal.my_role() = 'superadmin')
  with check (internal.my_role() = 'superadmin');

create policy "superadmin_all" on public.deposit_items for all
  to authenticated
  using (internal.my_role() = 'superadmin')
  with check (internal.my_role() = 'superadmin');

create policy "superadmin_all" on public.savings_ledger for all
  to authenticated
  using (internal.my_role() = 'superadmin')
  with check (internal.my_role() = 'superadmin');

create policy "superadmin_all" on public.withdrawals for all
  to authenticated
  using (internal.my_role() = 'superadmin')
  with check (internal.my_role() = 'superadmin');

create policy "superadmin_all" on public.shipments for all
  to authenticated
  using (internal.my_role() = 'superadmin')
  with check (internal.my_role() = 'superadmin');

create policy "superadmin_all" on public.shipment_items for all
  to authenticated
  using (internal.my_role() = 'superadmin')
  with check (internal.my_role() = 'superadmin');

create policy "superadmin_all" on public.waste_categories for all
  to authenticated
  using (internal.my_role() = 'superadmin')
  with check (internal.my_role() = 'superadmin');
