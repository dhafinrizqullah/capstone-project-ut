-- RW/RT master table: areas replace free-text rt/rw columns so the RW -> RT
-- hierarchy has a single managed source (FK from profiles).
create table public.areas (
  id bigint generated always as identity primary key,
  rw text not null,
  rt text not null,
  created_at timestamptz not null default now(),
  unique (rw, rt)
);
alter table public.areas enable row level security;
create policy "areas_select_all" on public.areas for select
  to authenticated using (true);
create policy "areas_insert_staff" on public.areas for insert
  to authenticated with check (internal.my_role() in ('petugas', 'pengurus_rw'));
create policy "areas_update_staff" on public.areas for update
  to authenticated
  using (internal.my_role() in ('petugas', 'pengurus_rw'))
  with check (internal.my_role() in ('petugas', 'pengurus_rw'));
create policy "areas_delete_staff" on public.areas for delete
  to authenticated using (internal.my_role() = 'pengurus_rw');
create policy "superadmin_all" on public.areas for all
  to authenticated
  using (internal.my_role() = 'superadmin')
  with check (internal.my_role() = 'superadmin');
grant select, insert, update, delete on public.areas to authenticated;

-- Link profiles, backfill from existing text, then drop the text columns
alter table public.profiles add column area_id bigint references public.areas (id);
insert into public.areas (rw, rt)
  select distinct rw, rt from public.profiles
  where rw is not null and rt is not null
  on conflict (rw, rt) do nothing;
update public.profiles p set area_id = a.id
  from public.areas a where a.rw = p.rw and a.rt = p.rt;
alter table public.profiles drop column rt;
alter table public.profiles drop column rw;
