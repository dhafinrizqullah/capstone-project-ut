// Realistic demo dataset: residents, 6 months of weighings, ledger entries,
// withdrawals, and collector shipments. Rerunnable: wipes demo transactions first.
// DEV ONLY — never run against production. Run: pnpm db:demo (reads local .env).
import { URL, HEADERS, api, ensureUser } from './supabase-admin.mjs'

const PASSWORD = 'bank-sampah-123'

// Seeded RNG so every run produces the same believable dataset
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261017)
const pick = (arr, n) => [...arr].sort(() => rand() - 0.5).slice(0, n)
const round1 = v => Math.round(v * 10) / 10

const RESIDENTS = [
  { email: 'warga@rw05.id', full_name: 'Budi Santoso', rt: 'RT 01', rw: 'RW 05' },
  { email: 'dewi@rw05.id', full_name: 'Dewi Lestari', rt: 'RT 01', rw: 'RW 05' },
  { email: 'agus@rw05.id', full_name: 'Agus Wijaya', rt: 'RT 01', rw: 'RW 05' },
  { email: 'siti@rw05.id', full_name: 'Siti Rahayu', rt: 'RT 02', rw: 'RW 05' },
  { email: 'rina@rw05.id', full_name: 'Rina Marlina', rt: 'RT 02', rw: 'RW 05' },
  { email: 'joko@rw05.id', full_name: 'Joko Prasetyo', rt: 'RT 02', rw: 'RW 05' },
  { email: 'maya@rw05.id', full_name: 'Maya Putri', rt: 'RT 03', rw: 'RW 05' },
  { email: 'andi@rw05.id', full_name: 'Andi Nugroho', rt: 'RT 03', rw: 'RW 05' },
  { email: 'fitri@rw06.id', full_name: 'Fitri Handayani', rt: 'RT 01', rw: 'RW 06' },
  { email: 'dedi@rw06.id', full_name: 'Dedi Kurniawan', rt: 'RT 01', rw: 'RW 06' },
  { email: 'nina@rw06.id', full_name: 'Nina Sari', rt: 'RT 02', rw: 'RW 06' },
  { email: 'hendra@rw06.id', full_name: 'Hendra Gunawan', rt: 'RT 02', rw: 'RW 06' },
]

// 1. extra categories + residents
await api('/rest/v1/waste_categories', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates' },
  body: JSON.stringify([
    { name: 'Kaca', price_per_kg: 2000 },
    { name: 'Kardus', price_per_kg: 2500 },
  ]),
})
const cats = await api('/rest/v1/waste_categories?select=id,name,price_per_kg&active=eq.true')

const residentIds = {}
for (const r of RESIDENTS) {
  residentIds[r.email] = await ensureUser({ ...r, password: PASSWORD, role: 'warga' })
}
const operatorId = await ensureUser({ email: 'petugas@rw05.id', password: PASSWORD, full_name: 'Andi Petugas', role: 'petugas', rt: null, rw: 'RW 05' })
const collectorId = await ensureUser({ email: 'pengepul@rw05.id', password: PASSWORD, full_name: 'CV Maju Bersama', role: 'pengepul', rt: null, rw: 'RW 05' })

// 2. wipe previous demo transactions (fresh, stable dataset every run)
for (const rid of Object.values(residentIds)) {
  await fetch(`${URL}/rest/v1/savings_ledger?resident_id=eq.${rid}`, { method: 'DELETE', headers: HEADERS })
  await fetch(`${URL}/rest/v1/withdrawals?resident_id=eq.${rid}`, { method: 'DELETE', headers: HEADERS })
  await fetch(`${URL}/rest/v1/deposits?resident_id=eq.${rid}`, { method: 'DELETE', headers: HEADERS })
}
await fetch(`${URL}/rest/v1/shipment_items?shipment_id=gt.0`, { method: 'DELETE', headers: HEADERS })
await fetch(`${URL}/rest/v1/shipments?id=gt.0`, { method: 'DELETE', headers: HEADERS })

// 3. six months of weighings
const now = Date.now()
let depCount = 0
for (const r of RESIDENTS) {
  const n = 4 + Math.floor(rand() * 7)
  for (let i = 0; i < n; i++) {
    const at = new Date(now - rand() * 180 * 86400_000)
    at.setHours(7 + Math.floor(rand() * 10), Math.floor(rand() * 60), 0, 0)
    const lines = pick(cats, 1 + Math.floor(rand() * 3)).map((c) => {
      const weight = round1(0.5 + rand() * 7.5)
      const price = Number(c.price_per_kg)
      return { category_id: c.id, weight_kg: weight, price_per_kg: price, value: Math.round(weight * price) }
    })
    const [dep] = await api('/rest/v1/deposits', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        resident_id: residentIds[r.email],
        operator_id: operatorId,
        deposited_at: at.toISOString(),
        total_weight: round1(lines.reduce((s, l) => s + l.weight_kg, 0)),
        total_value: lines.reduce((s, l) => s + l.value, 0),
      }),
    })
    await api('/rest/v1/deposit_items', {
      method: 'POST',
      body: JSON.stringify(lines.map(l => ({ ...l, deposit_id: dep.id }))),
    })
    await api('/rest/v1/savings_ledger', {
      method: 'POST',
      body: JSON.stringify({
        resident_id: residentIds[r.email],
        type: 'kredit',
        amount: lines.reduce((s, l) => s + l.value, 0),
        reference: `deposit:${dep.id}`,
      }),
    })
    depCount++
  }
}

// 4. withdrawals: one approved (with debit), one pending, one rejected
const wd = async (email, amount, status) => {
  const [row] = await api('/rest/v1/withdrawals', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ resident_id: residentIds[email], amount, status }),
  })
  if (status === 'disetujui') {
    await api(`/rest/v1/withdrawals?id=eq.${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ validated_by: operatorId, validated_at: new Date().toISOString() }),
    })
    await api('/rest/v1/savings_ledger', {
      method: 'POST',
      body: JSON.stringify({ resident_id: residentIds[email], type: 'debit', amount, reference: `withdrawal:${row.id}` }),
    })
  }
  return row
}
await wd('siti@rw05.id', 50000, 'disetujui')
await wd('maya@rw05.id', 100000, 'menunggu')
await wd('joko@rw05.id', 75000, 'ditolak')

// 5. two collector shipments
const mkShipment = async (status, dayAgo) => {
  const lines = pick(cats, 2 + Math.floor(rand() * 2)).map((c) => {
    const weight = round1(20 + rand() * 80)
    const price = Number(c.price_per_kg)
    return { category_id: c.id, weight_kg: weight, price_per_kg: price, value: Math.round(weight * price) }
  })
  const [ship] = await api('/rest/v1/shipments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      collector_id: collectorId,
      operator_id: operatorId,
      shipped_at: new Date(now - dayAgo * 86400_000).toISOString(),
      total_weight: round1(lines.reduce((s, l) => s + l.weight_kg, 0)),
      total_value: lines.reduce((s, l) => s + l.value, 0),
      status,
    }),
  })
  await api('/rest/v1/shipment_items', {
    method: 'POST',
    body: JSON.stringify(lines.map(l => ({ ...l, shipment_id: ship.id }))),
  })
  return ship.note_number
}
const n1 = await mkShipment('diterima', 9)
const n2 = await mkShipment('dikirim', 2)

console.log(`\nDone: ${RESIDENTS.length} residents, ${depCount} deposits, 3 withdrawals, notes ${n1} + ${n2}`)
