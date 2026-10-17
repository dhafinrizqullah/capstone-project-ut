# Capstone Project UT

Web application built with **Nuxt 4** and **Supabase**.

## Stack

- Nuxt 4 (Vue 3, TypeScript)
- Supabase (Postgres, Auth, Storage)
- Tailwind CSS via `@nuxt/ui`
- Vitest

Default application language: Indonesian.

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Environment

Create a `.env` file with (see `.env.example`):

```env
NUXT_PUBLIC_SUPABASE_URL=
NUXT_PUBLIC_SUPABASE_KEY=
SUPABASE_SERVICE_KEY=
```

## Database (Supabase)

Link the repo to the Supabase project once:

```bash
brew install supabase/tap/supabase
supabase login
supabase init      # skip if the supabase/ folder already exists
supabase link --project-ref <your-project-ref>
# 0001 was applied manually via the SQL Editor, mark it so it is not re-applied:
supabase migration repair --status applied 20261017000000
```

After that, whenever there is a new file in `supabase/migrations/`:

```bash
pnpm db:push   # apply pending migrations
pnpm db:seed   # (dev) create/refresh the 4 demo accounts (one per role)
```

## Scripts

- `pnpm dev` - start dev server
- `pnpm build` - production build
- `pnpm test` - run tests
- `pnpm test:e2e` - run the full E2E suite (starts the dev server itself)
- `pnpm lint` - lint code
- `pnpm db:push` - apply pending Supabase migrations
- `pnpm db:seed` - (dev) seed 4 demo accounts, one per role
- `pnpm db:demo` - (dev) realistic demo dataset (residents, 6 months of weighings, withdrawals, shipments)

## E2E gate before push

Every push runs the whole E2E suite through a `pre-push` hook in `.githooks/`
(`core.hooksPath` is set by `pnpm install`, via the `prepare` script). The suite
drives the seeded demo accounts on the dev Supabase project, so run
`pnpm db:seed` (and `pnpm db:demo` for the list/report specs) first.

- bypass once with `git push --no-verify`
- `pnpm test:e2e` starts `pnpm dev` when port 3000 is idle and reuses a running
  dev server otherwise; `APP_URL` points it at another origin
- specs: `tests/roles.e2e.ts` (per-role menu, page access, guards, 360px),
  `tests/flows.e2e.ts` (one real action per role), `tests/admin-users.e2e.ts`,
  `tests/auth.e2e.ts`, `tests/responsive.e2e.ts`

## License

MIT
