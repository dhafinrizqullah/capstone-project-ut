-- Skema penuh: transaksi bank sampah + RLS per peran.
-- Aturan tipe: teks -> TEXT, uang/berat -> numeric, waktu -> timestamptz.

-- 1. profiles: tambah peran superadmin
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('warga', 'petugas', 'pengepul', 'pengurus_rw', 'superadmin'));

-- Helper peran pemanggil (invoker: hanya membaca baris milik sendiri)
create or replace function public.my_role()
returns text language sql stable security invoker set search_path = public
as $$ select role from public.profiles where id = (select auth.uid()) $$;

-- Petugas/pengurus butuh melihat daftar warga (kasir, validasi)
create policy "profiles_select_staff" on public.profiles for select
  to authenticated using (public.my_role() in ('petugas', 'pengurus_rw', 'superadmin'));

-- 2. deposits: satu penimbangan (header)
create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.profiles (id),
  operator_id uuid not null references public.profiles (id),
  deposited_at timestamptz not null default now(),
  total_weight numeric(12, 3) not null default 0,
  total_value numeric(14, 2) not null default 0,
  status text not null default 'tercatat' check (status in ('tercatat', 'dibatalkan'))
);
alter table public.deposits enable row level security;
create policy "deposits_select_own" on public.deposits for select
  to authenticated using (resident_id = (select auth.uid()));
create policy "deposits_select_staff" on public.deposits for select
  to authenticated using (public.my_role() in ('petugas', 'pengurus_rw'));
create policy "deposits_insert_petugas" on public.deposits for insert
  to authenticated with check (public.my_role() = 'petugas');
create policy "deposits_update_petugas" on public.deposits for update
  to authenticated
  using (public.my_role() = 'petugas')
  with check (public.my_role() = 'petugas');
create index deposits_resident_idx on public.deposits (resident_id);
create index deposits_operator_idx on public.deposits (operator_id);

-- 3. deposit_items: rincian per kategori (harga di-snapshot)
create table public.deposit_items (
  id uuid primary key default gen_random_uuid(),
  deposit_id uuid not null references public.deposits (id) on delete cascade,
  category_id bigint not null references public.waste_categories (id),
  weight_kg numeric(12, 3) not null check (weight_kg > 0),
  price_per_kg numeric(14, 2) not null check (price_per_kg >= 0),
  value numeric(14, 2) not null default 0
);
alter table public.deposit_items enable row level security;
create policy "deposit_items_select_staff" on public.deposit_items for select
  to authenticated using (public.my_role() in ('petugas', 'pengurus_rw'));
create policy "deposit_items_select_own" on public.deposit_items for select
  to authenticated using (
    exists (
      select 1 from public.deposits d
      where d.id = deposit_id and d.resident_id = (select auth.uid())
    )
  );
create policy "deposit_items_insert_petugas" on public.deposit_items for insert
  to authenticated with check (public.my_role() = 'petugas');
create index deposit_items_deposit_idx on public.deposit_items (deposit_id);

-- 4. savings_ledger: mutasi tabungan (saldo = SUM, tanpa kolom saldo)
create table public.savings_ledger (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.profiles (id),
  type text not null check (type in ('kredit', 'debit')),
  amount numeric(14, 2) not null check (amount > 0),
  reference text not null,
  created_at timestamptz not null default now()
);
alter table public.savings_ledger enable row level security;
create policy "ledger_select_own" on public.savings_ledger for select
  to authenticated using (resident_id = (select auth.uid()));
create policy "ledger_select_staff" on public.savings_ledger for select
  to authenticated using (public.my_role() in ('petugas', 'pengurus_rw'));
create policy "ledger_insert_petugas" on public.savings_ledger for insert
  to authenticated with check (public.my_role() = 'petugas');
create index ledger_resident_idx on public.savings_ledger (resident_id);

-- 5. withdrawals: pengajuan penarikan warga
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.profiles (id),
  amount numeric(14, 2) not null check (amount > 0),
  status text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
  validated_by uuid references public.profiles (id),
  validated_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.withdrawals enable row level security;
create policy "withdrawals_select_own" on public.withdrawals for select
  to authenticated using (resident_id = (select auth.uid()));
create policy "withdrawals_select_staff" on public.withdrawals for select
  to authenticated using (public.my_role() in ('petugas', 'pengurus_rw'));
create policy "withdrawals_insert_warga" on public.withdrawals for insert
  to authenticated
  with check (resident_id = (select auth.uid()) and status = 'menunggu');
create policy "withdrawals_update_petugas" on public.withdrawals for update
  to authenticated
  using (public.my_role() = 'petugas')
  with check (public.my_role() = 'petugas');
create index withdrawals_resident_idx on public.withdrawals (resident_id);

-- 6. shipments: pengiriman ke pengepul (nota otomatis SJ-000001)
create table public.shipments (
  id bigint generated always as identity primary key,
  note_number text generated always as ('SJ-' || lpad(id::text, 6, '0')) stored unique,
  collector_id uuid not null references public.profiles (id),
  operator_id uuid not null references public.profiles (id),
  shipped_at timestamptz not null default now(),
  total_weight numeric(12, 3) not null default 0,
  total_value numeric(14, 2) not null default 0,
  status text not null default 'dikirim' check (status in ('dikirim', 'diterima'))
);
alter table public.shipments enable row level security;
create policy "shipments_select" on public.shipments for select
  to authenticated using (
    collector_id = (select auth.uid())
    or public.my_role() in ('petugas', 'pengurus_rw')
  );
create policy "shipments_insert_petugas" on public.shipments for insert
  to authenticated with check (public.my_role() = 'petugas');
create policy "shipments_update" on public.shipments for update
  to authenticated
  using (
    public.my_role() = 'petugas'
    or (collector_id = (select auth.uid()) and public.my_role() = 'pengepul')
  )
  with check (
    public.my_role() = 'petugas'
    or (collector_id = (select auth.uid()) and public.my_role() = 'pengepul')
  );
create index shipments_collector_idx on public.shipments (collector_id);

-- 7. shipment_items
create table public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id bigint not null references public.shipments (id) on delete cascade,
  category_id bigint not null references public.waste_categories (id),
  weight_kg numeric(12, 3) not null check (weight_kg > 0),
  price_per_kg numeric(14, 2) not null check (price_per_kg >= 0),
  value numeric(14, 2) not null default 0
);
alter table public.shipment_items enable row level security;
create policy "shipment_items_select" on public.shipment_items for select
  to authenticated using (
    exists (
      select 1 from public.shipments s
      where s.id = shipment_id
        and (s.collector_id = (select auth.uid()) or public.my_role() in ('petugas', 'pengurus_rw'))
    )
  );
create policy "shipment_items_insert_petugas" on public.shipment_items for insert
  to authenticated with check (public.my_role() = 'petugas');
create index shipment_items_shipment_idx on public.shipment_items (shipment_id);

-- 8. waste_categories: kelola harga oleh petugas/pengurus (select sudah ada)
create policy "categories_insert_staff" on public.waste_categories for insert
  to authenticated with check (public.my_role() in ('petugas', 'pengurus_rw'));
create policy "categories_update_staff" on public.waste_categories for update
  to authenticated
  using (public.my_role() in ('petugas', 'pengurus_rw'))
  with check (public.my_role() in ('petugas', 'pengurus_rw'));
create policy "categories_delete_staff" on public.waste_categories for delete
  to authenticated using (public.my_role() = 'pengurus_rw');

-- 9. Ekspos Data API + default untuk tabel berikutnya
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
