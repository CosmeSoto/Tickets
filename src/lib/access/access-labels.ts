/** Etiquetas en español para el módulo Accesos (UI, exportación y correos). */

/**
 * Tipos de acceso que exigen arrendatario/empresa: empleado de arrendatario (es la relación
 * que define el tipo) y contratista (casi siempre reporta a una empresa contratista o a un
 * arrendatario que lo trajo). El visitante autorizado no la exige — puede no pertenecer a
 * ninguna empresa registrada (visita personal, entrega, etc.).
 * Compartido entre el formulario (frontend) y el schema de validación (API) para que ambos
 * apliquen exactamente la misma regla.
 */
const ACCESS_TYPES_REQUIRING_ORGANIZATION = new Set(['TENANT_EMPLOYEE', 'CONTRACTOR'])

export function accessTypeRequiresOrganization(type: string): boolean {
  return ACCESS_TYPES_REQUIRING_ORGANIZATION.has(type)
}

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
