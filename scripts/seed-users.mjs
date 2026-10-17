// Seed demo accounts per role via the Auth Admin API + profile upserts.
// ponytail: raw fetch, no new deps. Run: pnpm db:seed (reads local .env).
// DEV ONLY — never run against production.

const URL = (process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!URL || !SERVICE_KEY) {
  console.error('Missing NUXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env')
  process.exit(1)
}

// ponytail: demo credentials, rotate password after first login
const PASSWORD = 'bank-sampah-123'
const USERS = [
  { email: 'warga@rw05.id', full_name: 'Budi Santoso (Warga)', role: 'warga', rt: 'RT 01', rw: 'RW 05' },
  { email: 'petugas@rw05.id', full_name: 'Andi Petugas', role: 'petugas', rt: null, rw: 'RW 05' },
  { email: 'pengepul@rw05.id', full_name: 'CV Maju Bersama', role: 'pengepul', rt: null, rw: 'RW 05' },
  { email: 'admin@rw05.id', full_name: 'Pengurus RW 05', role: 'pengurus_rw', rt: null, rw: 'RW 05' },
  { email: 'superadmin@rw05.id', full_name: 'Superadmin Sistem', role: 'superadmin', rt: null, rw: 'RW 05' },
]

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function findUserId(email) {
  const res = await fetch(`${URL}/auth/v1/admin/users`, { headers })
  const { users } = await res.json()
  return users?.find((u) => u.email === email)?.id
}

for (const u of USERS) {
  let res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: u.email, password: PASSWORD, email_confirm: true }),
  })
  let id
  if (res.ok) {
    id = (await res.json()).id
    console.log(`create: ${u.email}`)
  }
  else {
    id = await findUserId(u.email) // already exists → reuse (rerunnable)
    console.log(`reuse: ${u.email}`)
  }
  if (!id) throw new Error(`failed to resolve id for ${u.email}`)

  res = await fetch(`${URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id, email: u.email, full_name: u.full_name, role: u.role, rt: u.rt, rw: u.rw }),
  })
  if (!res.ok) throw new Error(`failed to upsert profile ${u.email}: ${await res.text()}`)
}

console.log(`\nDone. Sign in with one of the emails above / password: ${PASSWORD}`)
