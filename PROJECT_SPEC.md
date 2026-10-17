# Project Spec: RW Waste Bank Digitalization & Waste Analytics Dashboard

## Summary

Web app for a community (RW) waste bank. Digitizes weighing transactions, resident savings, withdrawals, and outbound sales to collectors, plus an analytics dashboard for RW admins.

Stack: Nuxt 4 (Vue 3, TypeScript), Supabase (Postgres, Auth, Realtime), Tailwind via `@nuxt/ui`, Chart.js, PDF/Excel export.

## Roles (RBAC)

- **Resident (Warga)**: view current waste prices, weighing history, savings balance, request withdrawal.
- **Operator (Petugas)**: digital scale cashier with auto IDR calculation, manage waste price master, validate withdrawals, record outbound waste to collector.
- **Collector (Pengepul)**: receive and verify digital handover note.
- **RW Admin (Pengurus RW)**: analytics dashboard, monitor RT participation, export reports (PDF/Excel).

## Core Features

### Resident

- Current waste price list.
- Weighing transaction history.
- Savings balance.
- Withdrawal request.

### Operator

- Weighing cashier: input weight per waste category, auto-calculate IDR value, credit resident savings.
- Manage waste price master (category, unit price per kg).
- Validate/approve withdrawal requests.
- Record outbound shipment to collector and issue digital handover note.

### Collector

- View and verify digital handover note for a shipment.

### RW Admin

- Dashboard: waste volume by day/month, by category, RT participation.
- Export reports to PDF/Excel.

## Out of Scope

- Native mobile app.
- Multi-RW / multi-tenant.
- Payment gateway or bank transfer integration (withdrawals recorded/validated only).
- IoT scale integration (weight entered manually).
- Analytics from external/non-system data.

## Domain Model (suggested)

- `profiles`: user, role, RT.
- `waste_categories`: name, unit price per kg, active.
- `deposits`: resident, operator, date, total weight, total value.
- `deposit_items`: deposit, waste category, weight, price per kg, value.
- `savings_ledger`: resident, type (credit/debit), amount, reference.
- `withdrawals`: resident, amount, status, validated by operator.
- `shipments`: to collector, date, total weight, total value, note number.
- `shipment_items`: shipment, waste category, weight, price per kg, value.

## Auth & Security

- Supabase Auth with role-based access.
- RLS on all tables; residents see only their own data.
- Service role key server-only; anon key client-exposed.

## Non-Functional

- Web only, responsive.
- Default UI language: Indonesian (i18n-ready).
- Single RW deployment.
- Realtime sync for transactions and balances where useful.
- Reports exportable as PDF/Excel.

## Constraints

- Weight input is manual.
- Withdrawals are not integrated with banking/payment.
- Analytics limited to system-entered data.