-- Staff RW scope: petugas and pengurus_rw work inside one RW, so their RW is
-- recorded on the profile. Residents keep their RW on area_id (RW+RT);
-- pengepul and superadmin are not RW-bound and stay null.
-- ponytail: scope is enforced in queries/UI, RLS stays role-based (per-RW
-- isolation is still out of scope, as the areas migration noted).
alter table public.profiles add column if not exists rw text;

-- Existing staff were seeded into the single deployed RW.
update public.profiles set rw = 'RW 05'
  where rw is null and role in ('petugas', 'pengurus_rw');
