import { describe, expect, it } from 'vitest'
import { createLoginSchema } from '../app/utils/login-schema'

const schema = createLoginSchema({ email: 'Enter a valid email address', password: 'Password is required' })

describe('createLoginSchema', () => {
  it('accepts a valid email and password', () => {
    const r = schema.safeParse({ email: 'budi@rw05.id', password: 'rahasia123' })
    expect(r.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const r = schema.safeParse({ email: 'bukan-email', password: 'rahasia123' })
    expect(r.success).toBe(false)
  })

  it('rejects an empty password', () => {
    const r = schema.safeParse({ email: 'budi@rw05.id', password: '' })
    expect(r.success).toBe(false)
  })

  it('lowercases the email', () => {
    const r = schema.safeParse({ email: 'BUDI@RW05.ID', password: 'x' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('budi@rw05.id')
  })
})
