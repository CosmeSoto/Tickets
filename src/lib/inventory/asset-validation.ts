/**
 * Valida que el proveedor esté presente para modalidades RENTAL y LOAN.
 * Función pura — no accede a BD.
 */
export function validateSupplierRequirement(
  acquisitionMode: string | null | undefined,
  supplierId: string | null | undefined
): { valid: boolean; error?: string } {
  if (acquisitionMode === 'RENTAL' && !supplierId) {
    return { valid: false, error: 'El proveedor es obligatorio para activos en arrendamiento' }
  }
  if (acquisitionMode === 'LOAN' && !supplierId) {
    return { valid: false, error: 'El propietario es obligatorio para activos de tercero' }
  }
  return { valid: true }
}

/**
 * Valida que el contrato esté presente para modalidad RENTAL.
 * LOAN (activo de tercero prestado sin costo) NO requiere contrato.
 * Función pura — no accede a BD.
 */
export function validateContractRequirement(
  acquisitionMode: string | null | undefined,
  contractId: string | null | undefined,
  contractAction: 'create' | 'link' | null | undefined
): { valid: boolean; error?: string } {
  if (acquisitionMode === 'RENTAL') {
    if (!contractId && contractAction !== 'create') {
      return {
        valid: false,
        error: 'Debes asociar o crear un contrato para activos en arrendamiento',
      }
    }
  }
  return { valid: true }
}
