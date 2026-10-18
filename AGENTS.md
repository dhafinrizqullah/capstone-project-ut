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
- Area hierarchy is always RW → RT: RT options are scoped to the selected RW everywhere (dashboard, forms); changing RW resets an out-of-scope RT.
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
- Repo: `bank-sampah-rw` (this repo's own patterns — load it for every change here)
- Supabase: `supabase`, `supabase-postgres-best-practices`
- Design/UI: `frontend-design`, `web-design-guidelines`, `web-design-engineer` (visual polish/redesign tasks)
- Testing: `vitest`, `vue-testing-best-practices`

When implementing or reviewing UI, the design skills above must be used. When touching database/auth, the Supabase skills must be used. For responsive work, apply the Responsive patterns in `nuxt-ui` conventions, the quality floor (`frontend-design`), and the Touch/Safe-Areas/Layout rules (`web-design-guidelines`). For visual polish/redesign, follow `web-design-engineer` (declare the mini design decision first, verify with screenshots).

## Environment

- Never read, write, or modify `.env`. Treat it as off-limits.
- Only `.env.example` may be read or edited; use it as the source of truth for variable names.
- Keep `.env` gitignored. Commit `.env.example` with placeholder values only.
- Secrets stay server-only via `runtimeConfig`; client-exposed values use `NUXT_PUBLIC_*`.

## Notes

- All dates/times use **Asia/Jakarta (GMT+7)** — windows, filters, labels, and exports. Convert any UTC source before display or comparison; never assume the server/browser timezone. Shared helpers: `useDateRange` (civil-day bounds as UTC instants), `Intl.*` with `Asia/Jakarta`.
- Default application language is Indonesian (i18n-ready).
- Code is always English: comments, identifiers, commit messages, logs, and test names. Indonesian lives only in UI display strings (`i18n/locales/id.json`).
- Visual brand: deep emerald greens (gradient `emerald-950 → emerald-700`, `emerald-50` surfaces). Source of truth: `temp-project-capstone/mockups/*.html` — match it before inventing new styles.
- No production secrets in the repo; use `.env` (gitignored).
- Database changes go through Supabase migrations.