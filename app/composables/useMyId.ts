// ID user dari JWT claims (useSupabaseUser berisi claims, bukan objek user).
// Semua halaman privat lewat middleware auth, jadi sub selalu ada saat setup.
export function useMyId(): string {
  const user = useSupabaseUser()
  return (user.value as unknown as { sub: string } | null)?.sub ?? ''
}
