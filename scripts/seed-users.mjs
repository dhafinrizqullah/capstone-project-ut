// Seed akun demo per peran via Auth Admin API + upsert profiles.
// ponytail: fetch mentah, tanpa dep baru. Dijalankan: pnpm db:seed (baca .env lokal).
// DEV ONLY — jangan jalankan ke project production.

const URL = (process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!URL || !SERVICE_KEY) {
  console.error('Butuh NUXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_KEY di .env')
  process.exit(1)
}

// ponytail: kredensial demo, ganti password setelah login pertama
const PASSWORD = 'bank-sampah-123'
const USERS = [
  { email: 'warga@rw05.id', full_name: 'Budi Santoso (Warga)', role: 'warga', rt: 'RT 01' },
  { email: 'petugas@rw05.id', full_name: 'Andi Petugas', role: 'petugas', rt: null },
  { email: 'pengepul@rw05.id', full_name: 'CV Maju Bersama', role: 'pengepul', rt: null },
  { email: 'admin@rw05.id', full_name: 'Pengurus RW 05', role: 'pengurus_rw', rt: null },
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
    console.log(`buat: ${u.email}`)
  }
  else {
    id = await findUserId(u.email) // sudah ada → pakai yang lama (rerunnable)
    console.log(`pakai: ${u.email}`)
  }
  if (!id) throw new Error(`gagal resolve id untuk ${u.email}`)

  res = await fetch(`${URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id, email: u.email, full_name: u.full_name, role: u.role, rt: u.rt }),
  })
  if (!res.ok) throw new Error(`gagal upsert profil ${u.email}: ${await res.text()}`)
}

console.log(`\nSelesai. Login dengan salah satu email di atas / password: ${PASSWORD}`)
