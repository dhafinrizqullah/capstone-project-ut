---
name: bank-sampah-rw
description: Conventions for the RW Waste Bank (capstone-project-ut) repo — English routes, Indonesian UI, role dashboards, Supabase RLS patterns, emerald brand. Use when adding pages, tables, roles, or auth logic in this repo.
---

# Bank Sampah RW — Repo Conventions

Load this skill for ANY change in this repo, alongside the topic skills in `AGENTS.md`.

## Stack & commands

Nuxt 4 (`app/` srcDir) + `@nuxt/ui` + `@nuxtjs/supabase` + `@nuxtjs/i18n` + `chart.js` + `xlsx` (report only) + `zod`. Package manager `pnpm`.

```bash
pnpm dev | pnpm build | pnpm lint | pnpm test
pnpm db:push   # apply supabase/migrations
pnpm db:seed   # dev demo accounts (see scripts/seed-users.mjs)
pnpm db:demo   # dev realistic dataset, rerunnable (see scripts/seed-demo.mjs)
```

Gates before finishing: `pnpm lint`, `pnpm test`, `pnpm build` all green. E2E (`pnpm test:e2e`, needs `pnpm dev` running): deterministic `tests/*.e2e.ts` via `tester-army/e2e`, gateway `none` (no model key). Always `waitHydrated` (Vue `#__nuxt.__vue_app__`) before tapping — dev hydration is slow and early taps natively submit. Never install a new dependency for what the stack already does.

## Language rule (strict)

- Code is ALWAYS English: comments, identifiers, logs, test names, commit messages, SQL comments, API error strings.
- Indonesian exists ONLY as UI display strings in `i18n/locales/id.json` (form validation messages included — inject via `t()`, never hardcode).
- Routes are English; UI defaults to Indonesian (`defaultLocale: 'id'`, `strategy: 'no_prefix'`), switchable to English via the sidebar selector.

## Routes & roles (10 pages)

| Route | Role | Content |
|---|---|---|
| `/login` | public | email+password only, redirects by role after sign-in |
| `/` | `pengurus_rw` | analytics dashboard (Chart.js, `UTable` recent) |
| `/resident` | `warga` | prices, weighing history, balance, withdrawal request |
| `/cashier` | `petugas` | weighing cashier, auto-IDR, credits savings |
| `/cashier/prices` | `petugas`, `pengurus_rw` | price master CRUD (`UTable` + `UModal`) |
| `/cashier/payouts` | `petugas` | approve/reject withdrawals (debits on approve) |
| `/cashier/shipments` | `petugas` | outbound load + auto note `SJ-000001` |
| `/handover` | `pengepul` | verify notes, confirm receipt |
| `/report` | `pengurus_rw` | Excel export (`xlsx`), print-to-PDF |
| `/admin/users` | `superadmin` | create users per role via `POST /api/admin/users` |
| `/admin/areas` | `superadmin` | RW/RT master CRUD (combobox source everywhere) |
| `/denied` | any authed | access-denied fallback |

New page checklist: `definePageMeta({ layout: 'dashboard', middleware: ['auth', 'role'], allowedRoles: [...] })`, `<script>` first in SFC, `UDashboardPanel` + `#header` (`UDashboardNavbar` + `UDashboardSidebarCollapse`) + `#body`, all numbers/dates via `Intl.*` with `Asia/Jakarta`, empty states via `#empty` or `common.empty`.

## Auth & roles

- Supabase Auth only (bcrypt built in) — never store passwords, no `password` column anywhere.
- Role comes from `profiles.role` post-login, NEVER from client input (no role dropdown on login).
- `app/middleware/role.ts` enforces `allowedRoles`; `HOME_BY_ROLE` there is the single home map. Login redirects through it. `superadmin` passes every role gate (middleware + `superadmin_all` RLS), sees all sidebar menus, and gets an RT filter on `/`.
- User creation (any role incl. `superadmin`) ONLY via `server/api/admin/users.post.ts` with `serverSupabaseServiceRole` — service key never leaves the server. Caller must be `superadmin` (checked via user-context client).
- `useSupabaseUser()` holds **JWT claims, not the user object** — id is `.sub`. Always use the `useMyId()` composable, never `user.value.id`.

## Database

- Types: text → `TEXT`, money/weight → `numeric`, time → `timestamptz`, status → `TEXT + check`. No `password` column.
- Money is snapshotted per line item (`price_per_kg`, `value`); savings balance = `SUM(ledger)`, no balance column.
- RLS on EVERY table. Role checks go through `internal.my_role()` (SECURITY DEFINER in non-exposed schema + `auth.uid()` check). Never call an invoker function that reads `profiles` from a `profiles` policy — infinite recursion (error 54001).
- Query pattern: `TO authenticated` + ownership predicate, never bare `TO authenticated`. UPDATE needs `USING` + `WITH CHECK`. Index every FK.
- Workflow: `supabase migration new <name>` → SQL → `supabase db push` → spot-check RLS per role → `supabase db advisors` (or Dashboard → Advisors).
- Dev data: `pnpm db:seed` (service key, rerunnable). Never run seed against production.

## UI & brand

- Brand: deep emerald (`emerald-950 → emerald-700` gradients, `emerald-50` surfaces, primary=`emerald` in `app/app.config.ts`). Source of truth: `temp-project-capstone/mockups/*.html` — match it before inventing styles. Visual polish follows `web-design-engineer`.
- One `layouts/dashboard.vue` (`UDashboardGroup` + emerald `UDashboardSidebar`, plain `NuxtLink` list, role-filtered menu). Content pages stay light; buttons/badges inherit emerald from the theme.
- `UApp` wrapper required. Forms: `UForm` + `UFormField` + `zod`, `autocomplete` + `spellcheck=false` on auth fields, server errors in `UAlert[aria-live]`, `…` in placeholders.
- Responsive: clean at 360px, no horizontal overflow; sidebar becomes drawer on mobile; multi-column input rows collapse (`sm:` prefix); tables in `overflow-x-auto`.
- Area hierarchy is always RW → RT: every RT picker is scoped to the selected RW (dashboard filters, admin form); changing RW resets an out-of-scope RT.

## Gotchas already bitten (do not regress)

1. Cookie `Secure` is dev/prod-split in `nuxt.config.ts` — browsers reject `Secure` on `http://localhost`, silently killing sessions.
2. After sign-in, wait for the module auth listener before `navigateTo` (see `login.vue`); never `getUser()`-then-navigate blindly.
3. `app.vue` must render `<NuxtLayout><NuxtPage/></NuxtLayout>` or the dashboard layout never applies.
4. `@nuxtjs/i18n` locale files live at project-root `i18n/locales/`; theme colors go in `app/app.config.ts` (`ui.colors`), NOT `nuxt.config.ts`.
5. `pnpm lint` ignores `.agents/**` (third-party skill scripts).
