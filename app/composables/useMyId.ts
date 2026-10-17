// User id from JWT claims (useSupabaseUser holds claims, not the user object).
// Every private page passes through the auth middleware, so sub is always set in setup.
export function useMyId(): string {
  const user = useSupabaseUser()
  return (user.value as unknown as { sub: string } | null)?.sub ?? ''
}
