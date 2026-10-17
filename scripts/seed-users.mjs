// Seed demo accounts, one per role.
// DEV ONLY — never run against production. Run: pnpm db:seed (reads local .env).
import { ensureUser } from './supabase-admin.mjs'

// ponytail: demo credentials, rotate password after first login
const PASSWORD = 'bank-sampah-123'
const USERS = [
  { email: 'warga@rw05.id', full_name: 'Budi Santoso (Warga)', role: 'warga', rt: 'RT 01', rw: 'RW 05' },
  { email: 'petugas@rw05.id', full_name: 'Andi Petugas', role: 'petugas', rt: null, rw: 'RW 05' },
  { email: 'pengepul@rw05.id', full_name: 'CV Maju Bersama', role: 'pengepul', rt: null, rw: 'RW 05' },
  { email: 'admin@rw05.id', full_name: 'Pengurus RW 05', role: 'pengurus_rw', rt: null, rw: 'RW 05' },
  { email: 'superadmin@rw05.id', full_name: 'Superadmin Sistem', role: 'superadmin', rt: null, rw: 'RW 05' },
]

for (const u of USERS) await ensureUser({ ...u, password: PASSWORD })

console.log(`\nDone. Sign in with one of the emails above / password: ${PASSWORD}`)
