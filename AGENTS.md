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
- Mobile-first responsive by default: every page must render cleanly at 360px width with no horizontal overflow. Sidebar becomes drawer/slideover on mobile, multi-column grids collapse to one column, tables scroll horizontally or stack.
- Run `pnpm lint` and `pnpm test` before committing.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
```

## Skills (mandatory)

Project skills live under `.agents/skills/`. **Always load and apply the relevant skills before doing any work; do not skip this step.** If multiple apply, load all of them.

- Nuxt/Vue: `nuxt`, `vue`, `vue-best-practices`, `nuxt-ui`
- Supabase: `supabase`, `supabase-postgres-best-practices`
- Design/UI: `frontend-design`, `web-design-guidelines`
- Testing: `vitest`, `vue-testing-best-practices`

When implementing or reviewing UI, the design skills above must be used. When touching database/auth, the Supabase skills must be used. For responsive work, apply the Responsive patterns in `nuxt-ui` conventions, the quality floor (`frontend-design`), and the Touch/Safe-Areas/Layout rules (`web-design-guidelines`).

## Environment

- Never read, write, or modify `.env`. Treat it as off-limits.
- Only `.env.example` may be read or edited; use it as the source of truth for variable names.
- Keep `.env` gitignored. Commit `.env.example` with placeholder values only.
- Secrets stay server-only via `runtimeConfig`; client-exposed values use `NUXT_PUBLIC_*`.

## Notes

- Default application language is Indonesian (i18n-ready).
- No production secrets in the repo; use `.env` (gitignored).
- Database changes go through Supabase migrations.