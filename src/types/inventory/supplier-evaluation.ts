/**
 * Tipos de calificación de proveedores (historial anual por criterios).
 */

export type SupplierClassification = 'A' | 'B' | 'C'

export interface SupplierEvaluation {
  id: string
  supplierId: string
  year: number
  detail?: string | null
  quality: number
  creditTime: number
  deliveryTime: number
  price: number
  references: number
  equipmentScore: number
  total: number
  classification: SupplierClassification
  notes?: string | null
  evaluatedById?: string | null
  createdAt: string
  updatedAt: string
  supplier?: { id: string; name: string; email?: string | null; contactName?: string | null }
  evaluatedBy?: { id: string; name: string } | null
}

export interface SupplierEvaluationFormValues {
  year: number
  detail: string
  quality: number
  creditTime: number
  deliveryTime: number
  price: number
  references: number
  equipmentScore: number
  notes: string
}
