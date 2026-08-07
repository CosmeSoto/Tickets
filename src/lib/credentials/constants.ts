/** Nombre por defecto de bóveda de área (también en DB al auto-crear). */
export const DEFAULT_AREA_VAULT_NAME = 'Credenciales del área'

export const CREDENTIAL_ENTRY_TYPE_LABELS: Record<string, string> = {
  GENERIC: 'Genérico',
  EQUIPMENT: 'Equipo',
  LICENSE: 'Licencia',
  NETWORK: 'Red / acceso',
  SERVICE: 'Servicio / portal',
}

export const CREDENTIAL_ENTRY_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  ...Object.entries(CREDENTIAL_ENTRY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

/** Etiqueta corta para UI/filtros: evita repetir «Credenciales del área». */
export function formatCredentialVaultLabel(vault: {
  name: string
  kind?: string | null
  family?: { name: string } | null
}): string {
  if (vault.kind === 'PERSONAL') {
    return vault.name && vault.name !== DEFAULT_AREA_VAULT_NAME
      ? `${vault.name} · Personal`
      : 'Personal'
  }
  if (vault.family?.name) {
    if (!vault.name || vault.name === DEFAULT_AREA_VAULT_NAME) return vault.family.name
    return `${vault.family.name} · ${vault.name}`
  }
  return vault.name || 'Bóveda'
}
