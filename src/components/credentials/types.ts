/**
 * Tipos compartidos del módulo de Credenciales — el subconjunto usado por
 * los selectores de bóveda de `CreateCredentialDialog` y
 * `LinkedCredentialsCard`, antes redeclarado de forma idéntica en ambos
 * archivos. La página principal (`credentials/page.tsx`) tiene su propia
 * variante más completa (con `_count` y una `family` más rica) que no se
 * duplica en ningún otro archivo, así que se deja donde está.
 */
export type CredentialVaultOption = {
  id: string
  name: string
  kind: string
  familyId?: string | null
  family?: { id?: string; name: string; order?: number } | null
}
