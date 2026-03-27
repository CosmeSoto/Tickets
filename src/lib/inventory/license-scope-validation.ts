/**
 * Validates the XOR constraint for INDIVIDUAL license scope.
 * A license with INDIVIDUAL scope must have exactly one of:
 * - assignedToEquipment (not null)
 * - assignedToUser (not null)
 * Not both, not neither.
 */
export function validateIndividualScope(license: {
  assignedToEquipment: string | null | undefined
  assignedToUser: string | null | undefined
}): { valid: boolean; error?: string } {
  const hasEquipment = license.assignedToEquipment != null
  const hasUser = license.assignedToUser != null

  if (!hasEquipment && !hasUser) {
    return {
      valid: false,
      error: 'Una licencia individual debe estar asignada a un equipo o usuario',
    }
  }
  if (hasEquipment && hasUser) {
    return {
      valid: false,
      error: 'Una licencia individual no puede estar asignada a equipo y usuario simultáneamente',
    }
  }
  return { valid: true }
}
