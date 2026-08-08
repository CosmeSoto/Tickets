/**
 * Snapshot de auditoría para el maestro de proveedores.
 * Enmascara datos bancarios sensibles; no duplica el ledger de contratos.
 */

type SupplierLike = {
  name?: string | null
  legalName?: string | null
  typeId?: string | null
  familyId?: string | null
  taxId?: string | null
  email?: string | null
  phone?: string | null
  contactName?: string | null
  city?: string | null
  country?: string | null
  paymentTermsDays?: number | null
  creditLimit?: unknown
  creditCurrency?: string | null
  preferredPaymentMethod?: string | null
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountType?: string | null
  bankSwift?: string | null
  notes?: string | null
  isActive?: boolean | null
}

function maskAccount(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.replace(/\s+/g, '')
  if (trimmed.length <= 4) return '****'
  return `****${trimmed.slice(-4)}`
}

function creditLimitToNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    try {
      return (value as { toNumber: () => number }).toNumber()
    } catch {
      return Number(String(value))
    }
  }
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Resumen auditable (sin número de cuenta completo). */
export function buildSupplierAuditSnapshot(supplier: SupplierLike) {
  const notes = supplier.notes?.trim()
  return {
    supplierName: supplier.name ?? null,
    legalName: supplier.legalName ?? null,
    typeId: supplier.typeId ?? null,
    familyId: supplier.familyId ?? null,
    taxId: supplier.taxId ?? null,
    email: supplier.email ?? null,
    phone: supplier.phone ?? null,
    contactName: supplier.contactName ?? null,
    city: supplier.city ?? null,
    country: supplier.country ?? null,
    paymentTermsDays: supplier.paymentTermsDays ?? null,
    creditLimit: creditLimitToNumber(supplier.creditLimit),
    creditCurrency: supplier.creditCurrency ?? null,
    preferredPaymentMethod: supplier.preferredPaymentMethod ?? null,
    bankName: supplier.bankName ?? null,
    bankAccountMasked: maskAccount(supplier.bankAccountNumber),
    bankAccountType: supplier.bankAccountType ?? null,
    bankSwift: supplier.bankSwift ?? null,
    notesPreview: notes ? notes.slice(0, 200) : null,
    isActive: supplier.isActive ?? null,
  }
}

export function supplierAuditMessage(
  action: 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'REACTIVATE' | 'DELETE',
  name: string,
  email: string | null | undefined
) {
  const by = email || 'sistema'
  const verbs: Record<typeof action, string> = {
    CREATE: 'creado',
    UPDATE: 'actualizado',
    DEACTIVATE: 'desactivado',
    REACTIVATE: 'reactivado',
    DELETE: 'eliminado',
  }
  return `Proveedor "${name}" ${verbs[action]} por ${by}`
}
