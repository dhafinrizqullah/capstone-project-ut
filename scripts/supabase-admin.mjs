// Shared helpers for dev seed scripts (service-key Admin API + REST).
// DEV ONLY — never import from app code.

const BASE = (process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!BASE || !SERVICE_KEY) {
  console.error('Missing NUXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env')
  process.exit(1)
}

export const URL = BASE
export const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

export async function api(path, opts = {}) {
  const res = await fetch(URL + path, {
    ...opts,
    headers: { ...HEADERS, ...(opts.headers || {}) },
  })
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function findUserId(email) {
  const { users } = await api('/auth/v1/admin/users')
  return users?.find(u => u.email === email)?.id
}

export async function ensureArea(rw, rt) {
  if (!rw || !rt) return null
  const found = await api(`/rest/v1/areas?rw=eq.${encodeURIComponent(rw)}&rt=eq.${encodeURIComponent(rt)}&select=id&limit=1`)
  if (found?.length) return found[0].id
  const [row] = await api('/rest/v1/areas', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ rw, rt }),
  })
  return row.id
}

export async function ensureUser({ email, password, full_name, role, rt, rw }) {
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  let id
  let created = false
  if (res.ok) {
    id = (await res.json()).id
    created = true
  }
  else {
    id = await findUserId(email) // already exists → reuse (rerunnable)
  }
  if (!id) throw new Error(`failed to resolve id for ${email}`)
  const areaId = role === 'warga' ? await ensureArea(rw, rt) : null
  // residents are scoped by area (RW+RT); RW-bound staff by the profile's rw
  const staffRw = role === 'petugas' || role === 'pengurus_rw' ? rw ?? 'RW 05' : null
  await api('/rest/v1/profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id, email, full_name, role, area_id: areaId, rw: staffRw }),
  })
  console.log(`${created ? 'create' : 'reuse'}: ${email}`)
  return id
}
