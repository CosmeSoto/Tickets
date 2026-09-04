/**
 * Zod schema para el alta masiva de licencias.
 *
 * A diferencia del lote de equipos (bulk-equipment.ts), acá las unidades NO son
 * idénticas: cada renglón puede tener su propio tipo de licencia (p. ej. M365
 * Básico / Business Premium / +Power BI) y su propio colaborador asignado —
 * solo comparten proveedor, N° de factura/orden de compra y fecha de compra.
 * Caso real: una orden de compra anual de 60 licencias de distintos planes,
 * cada una asignada a una persona distinta.
 */
import { z } from 'zod'
import { INVOICE_NUMBER_PATTERN, INVOICE_NUMBER_ERROR } from '@/lib/inventory/invoice-number'

export const bulkLicenseRowSchema = z.object({
  licenseTypeId: z.string().uuid('Tipo de licencia inválido'),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  assignedToUser: z.string().uuid().optional().or(z.literal('')),
  cost: z.number().nonnegative('El costo no puede ser negativo').optional(),
  key: z.string().max(500).optional().or(z.literal('')),
})

export const bulkLicenseInputSchema = z.object({
  familyId: z.string().uuid('Familia inválida'),
  supplierId: z.string().uuid().optional().or(z.literal('')),
  // Mismo formato que el resto del módulo de inventario (solo dígitos y guion) —
  // ver invoice-number.ts. El input ya sanitiza en tiempo real en el cliente;
  // esto es la validación de defensa en profundidad del lado del servidor.
  invoiceNumber: z
    .string()
    .max(100)
    .regex(INVOICE_NUMBER_PATTERN, INVOICE_NUMBER_ERROR)
    .optional()
    .or(z.literal('')),
  purchaseOrderNumber: z
    .string()
    .max(100)
    .regex(INVOICE_NUMBER_PATTERN, INVOICE_NUMBER_ERROR)
    .optional()
    .or(z.literal('')),
  /**
   * Contrato (tabla `contracts`) al que se vinculan TODAS las licencias del lote —
   * ej. una orden de compra recurrente. Si viene, el costo de cada fila se suma al
   * total recurrente del contrato en vez de generar una factura PENDIENTE por
   * licencia (ver bulk-license.service.ts).
   */
  contractId: z.string().uuid().optional().or(z.literal('')),
  purchaseDate: z
    .string()
    .optional()
    .transform(v => (v ? new Date(v) : undefined)),
  rows: z
    .array(bulkLicenseRowSchema)
    .min(1, 'Agrega al menos una licencia')
    .max(200, 'Máximo 200 licencias por lote'),
})

export type BulkLicenseInput = z.infer<typeof bulkLicenseInputSchema>
