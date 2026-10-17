import * as z from 'zod'

// ponytail: email+password only — role comes from profiles table post-login, never from client input
export const loginSchema = z.object({
  email: z.email('Masukkan alamat email yang valid').trim().toLowerCase(),
  password: z.string('Kata sandi wajib diisi').min(1, 'Kata sandi wajib diisi'),
})

export type LoginSchema = z.output<typeof loginSchema>
