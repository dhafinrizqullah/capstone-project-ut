import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import * as z from 'zod'
import type { Database } from '~/types/database.types'

const bodySchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, 'Minimum 8 characters'),
  full_name: z.string().trim().min(1),
  // superadmin is never created here — only by the dev seed / manual provisioning
  role: z.enum(['warga', 'petugas', 'pengepul', 'pengurus_rw']),
  rt: z.string().trim().nullable().optional(),
  rw: z.string().trim().optional(),
}).superRefine((body, ctx) => {
  // residents are placed by area (RW + RT); RW-bound staff carry their RW on the profile
  const needsArea = body.role === 'warga'
  const needsRw = body.role === 'petugas' || body.role === 'pengurus_rw'
  if (needsArea && (!body.rw || !body.rt)) {
    ctx.addIssue({ code: 'custom', path: ['rt'], message: 'Ward and unit are required' })
  }
  if (needsRw && !body.rw) {
    ctx.addIssue({ code: 'custom', path: ['rw'], message: 'Ward is required for this role' })
  }
})

export default defineEventHandler(async (event) => {
  // superadmin only — the service key never leaves the server
  const userClient = await serverSupabaseClient<Database>(event)
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const { data: me } = await userClient.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'superadmin') throw createError({ statusCode: 403, message: 'Forbidden' })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message ?? 'Invalid' })
  const body = parsed.data

  const admin = await serverSupabaseServiceRole<Database>(event)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  })
  if (createErr || !created.user) throw createError({ statusCode: 400, message: createErr?.message ?? 'Create failed' })

  // RW -> RT resolves through the areas master (created on demand)
  let areaId: number | null = null
  if (body.role === 'warga' && body.rw && body.rt) {
    const { data: existing } = await admin
      .from('areas')
      .select('id')
      .eq('rw', body.rw)
      .eq('rt', body.rt)
      .maybeSingle()
    areaId = existing?.id ?? null
    if (!areaId) {
      const { data: made, error: areaErr } = await admin
        .from('areas')
        .insert({ rw: body.rw, rt: body.rt })
        .select('id')
        .single()
      if (areaErr || !made) throw createError({ statusCode: 400, message: areaErr?.message ?? 'Area failed' })
      areaId = made.id
    }
  }

  const { error: profileErr } = await admin.from('profiles').upsert({
    id: created.user.id,
    email: body.email,
    full_name: body.full_name,
    role: body.role,
    area_id: areaId,
    // staff scope only: residents carry their RW through area_id
    rw: body.role === 'petugas' || body.role === 'pengurus_rw' ? body.rw : null,
  })
  if (profileErr) throw createError({ statusCode: 400, message: profileErr.message })

  return { email: body.email }
})
