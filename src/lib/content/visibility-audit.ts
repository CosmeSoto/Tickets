/** Resumen de visibilidad para auditoría de Documentos / Noticias */

export function buildVisibilityAuditSummary(input: {
  roles?: string[]
  familyIds?: string[]
  departmentIds?: string[]
  userIds?: string[]
}) {
  const roles = input.roles ?? []
  const familyIds = input.familyIds ?? []
  const departmentIds = input.departmentIds ?? []
  const userIds = input.userIds ?? []
  const total = roles.length + familyIds.length + departmentIds.length + userIds.length

  return {
    visibility: {
      roles,
      familyIds,
      departmentIds,
      userIds,
      mode: total === 0 ? 'unrestricted_or_scope_default' : 'restricted',
      filterCount: total,
    },
  }
}
