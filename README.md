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
- `pnpm test:e2e` - run E2E suite (needs `pnpm dev` running)
- `pnpm lint` - lint code
- `pnpm db:push` - apply pending Supabase migrations
- `pnpm db:seed` - (dev) seed 4 demo accounts, one per role

## License

MIT
