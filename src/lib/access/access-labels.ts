/** Etiquetas en español para el módulo Accesos (UI, exportación y correos). */

export function accessTypeLabel(type: string): string {
  switch (type) {
    case 'TENANT_EMPLOYEE':
      return 'Empleado de arrendatario'
    case 'CONTRACTOR':
      return 'Contratista'
    case 'AUTHORIZED_VISITOR':
      return 'Visitante autorizado'
    default:
      return 'Visitante autorizado'
  }
}

export function formatAccessPurpose(purpose?: string | null): string {
  const trimmed = purpose?.trim()
  return trimmed || '—'
}

/** Resumen corto: área + arrendatario (dónde pertenece el acceso). */
export function formatAccessBelongsTo(familyName: string, organization?: string | null): string {
  const org = organization?.trim()
  if (org) return `${familyName} · ${org}`
  return familyName
}
