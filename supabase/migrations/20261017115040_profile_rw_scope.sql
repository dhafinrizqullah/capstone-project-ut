-- RW scope readiness: every profile carries its RW (TEXT, single-RW deployment
-- for now; true multi-RW tenant isolation stays out of scope per spec).
alter table public.profiles add column if not exists rw text not null default 'RW 05';
