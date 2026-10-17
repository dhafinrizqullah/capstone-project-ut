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

## Scripts

- `pnpm dev` - start dev server
- `pnpm build` - production build
- `pnpm test` - run tests
- `pnpm lint` - lint code

## License

MIT