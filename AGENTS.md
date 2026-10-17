# AGENTS.md

## Project

Web application built with **Nuxt 4** and **Supabase** (Postgres, Auth, Storage, Edge Functions).

## Stack

- Framework: Nuxt 4 (Vue 3, TypeScript)
- Backend / BaaS: Supabase
- Styling: Tailwind CSS via `@nuxt/ui`
- Testing: Vitest
- Package manager: pnpm (preferred)

## Conventions

- Use TypeScript everywhere; avoid `any`.
- Follow Vue/Nuxt best practices: Composition API with `<script setup>`.
- Keep components small and colocated; prefer auto-imports provided by Nuxt.
- Validate and type all Supabase responses; never trust client input.
- RLS policies are required for every table; test them.
- Run `pnpm lint` and `pnpm test` before committing.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
```

## Skills

Project skills live under `.agents/skills/`. Load the relevant one before work:

- Nuxt/Vue: `nuxt`, `vue`, `vue-best-practices`, `nuxt-ui`
- Supabase: `supabase`, `supabase-postgres-best-practices`
- Testing: `vitest`, `vue-testing-best-practices`

## Notes

- No production secrets in the repo; use `.env` (gitignored).
- Database changes go through Supabase migrations.