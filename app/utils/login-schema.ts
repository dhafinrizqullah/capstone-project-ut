import * as z from 'zod'

// ponytail: email+password only — role comes from profiles table post-login, never from client input.
// Messages are injected so validation speaks the active UI locale (see i18n/locales).
export function createLoginSchema(m: { email: string, password: string }) {
  return z.object({
    email: z.email(m.email).trim().toLowerCase(),
    password: z.string(m.password).min(1, m.password),
  })
}

export type LoginSchema = z.output<ReturnType<typeof createLoginSchema>>
