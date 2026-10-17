-- 0001_init: tabel inti + RLS + seed kategori (tahap awal, tabel transaksi menyusul)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('warga', 'petugas', 'pengepul', 'pengurus_rw')),
  rt text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select
  to authenticated using ((select auth.uid()) = id);

create table public.waste_categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  price_per_kg numeric(12,2) not null check (price_per_kg >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.waste_categories enable row level security;
create policy "categories_select_all" on public.waste_categories for select
  to authenticated using (true);

insert into public.waste_categories (name, price_per_kg) values
  ('Plastik PET', 4500),
  ('Kertas', 3000),
  ('Organik', 1000),
  ('Logam', 6000)
on conflict (name) do nothing;
