import { describe, expect, it } from 'vitest'
import { loginSchema } from '../app/utils/login-schema'

describe('loginSchema', () => {
  it('menerima email dan kata sandi yang valid', () => {
    const r = loginSchema.safeParse({ email: 'budi@rw05.id', password: 'rahasia123' })
    expect(r.success).toBe(true)
  })

  it('menolak email yang tidak valid', () => {
    const r = loginSchema.safeParse({ email: 'bukan-email', password: 'rahasia123' })
    expect(r.success).toBe(false)
  })

  it('menolak kata sandi kosong', () => {
    const r = loginSchema.safeParse({ email: 'budi@rw05.id', password: '' })
    expect(r.success).toBe(false)
  })

  it('menormalkan huruf email menjadi kecil', () => {
    const r = loginSchema.safeParse({ email: 'BUDI@RW05.ID', password: 'x' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('budi@rw05.id')
  })
})
