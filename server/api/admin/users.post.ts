import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import * as z from 'zod'
import type { Database } from '~/types/database.types'

const bodySchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, 'Minimum 8 characters'),
  full_name: z.string().trim().min(1),
  role: z.enum(['warga', 'petugas', 'pengepul', 'pengurus_rw', 'superadmin']),
  rt: z.string().trim().nullable().optional(),
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

  const { error: profileErr } = await admin.from('profiles').upsert({
    id: created.user.id,
    email: body.email,
    full_name: body.full_name,
    role: body.role,
    rt: body.role === 'warga' ? (body.rt || null) : null,
  })
  if (profileErr) throw createError({ statusCode: 400, message: profileErr.message })

  return { email: body.email }
})
