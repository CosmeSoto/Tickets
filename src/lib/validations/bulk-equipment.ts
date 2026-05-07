/**
 * Zod validation schemas for bulk equipment operations
 * Validates bulk creation inputs with quantity, codes, and serial numbers
 */

import { z } from 'zod'
import { EquipmentCondition, OwnershipType } from '@prisma/client'

/**
 * Schema for bulk equipment creation input
 * Validates quantity, code mode, manual codes, serial numbers, and common equipment data
 */
export const bulkEquipmentInputSchema = z
  .object({
    // Quantity and code generation
    quantity: z
      .number()
      .int('La cantidad debe ser un número entero')
      .min(1, 'La cantidad mínima es 1')
      .max(100, 'La cantidad máxima es 100'),

    codeMode: z.enum(['auto', 'manual'], {
      errorMap: () => ({ message: 'El modo de código debe ser "auto" o "manual"' }),
    }),

    manualCodes: z.array(z.string().min(1)).optional(),

    serialNumbers: z.array(z.string()).optional(),

    // Common equipment data (reuse from existing equipment schema)
    brand: z.string().min(1, 'La marca es requerida').max(100, 'La marca es muy larga'),

    model: z.string().min(1, 'El modelo es requerido').max(100, 'El modelo es muy largo'),

    typeId: z.string().uuid('ID de tipo inválido'),

    departmentId: z.string().uuid('ID de departamento inválido'),

    condition: z.nativeEnum(EquipmentCondition, {
      errorMap: () => ({ message: 'Condición inválida' }),
    }),

    ownershipType: z.nativeEnum(OwnershipType, {
      errorMap: () => ({ message: 'Tipo de propiedad inválido' }),
    }),

    purchasePrice: z.number().positive('El precio debe ser positivo').optional().or(z.literal(0)),

    supplierId: z.string().uuid('ID de proveedor inválido').optional().or(z.literal('')),

    purchaseDate: z
      .string()
      .datetime('Fecha de compra inválida')
      .optional()
      .or(z.date())
      .transform(val => (val ? new Date(val) : undefined)),

    specifications: z.record(z.any()).optional(),

    accessories: z.array(z.string()).optional(),

    notes: z.string().max(2000, 'Las notas son muy largas').optional().or(z.literal('')),

    photoUrl: z.string().url('URL de foto inválida').optional().or(z.literal('')),

    warehouseId: z.string().uuid('ID de almacén inválido').optional().or(z.literal('')),
  })
  .refine(
    data => {
      // If codeMode is 'manual', manualCodes must be provided and match quantity
      if (data.codeMode === 'manual') {
        if (!data.manualCodes || data.manualCodes.length === 0) {
          return false
        }
        return data.manualCodes.length === data.quantity
      }
      return true
    },
    {
      message:
        'Cuando el modo de código es "manual", debes proporcionar exactamente la misma cantidad de códigos que unidades',
      path: ['manualCodes'],
    }
  )
  .refine(
    data => {
      // If serialNumbers are provided, non-empty count must match quantity or be completely empty
      if (data.serialNumbers && data.serialNumbers.length > 0) {
        const nonEmptySerials = data.serialNumbers.filter(s => s.trim().length > 0)
        if (nonEmptySerials.length === 0) {
          return true // All empty is OK
        }
        return nonEmptySerials.length === data.quantity
      }
      return true
    },
    {
      message:
        'La cantidad de números de serie no vacíos debe coincidir con la cantidad de unidades, o dejar el campo vacío',
      path: ['serialNumbers'],
    }
  )

/**
 * Type inference from schema
 */
export type BulkEquipmentInput = z.infer<typeof bulkEquipmentInputSchema>

/**
 * Validate manual codes for uniqueness
 * This is a separate validation because it requires database check
 */
export function validateManualCodesUniqueness(codes: string[]): {
  valid: boolean
  duplicates: string[]
} {
  const seen = new Set<string>()
  const duplicates: string[] = []

  for (const code of codes) {
    const normalized = code.trim().toUpperCase()
    if (seen.has(normalized)) {
      duplicates.push(code)
    } else {
      seen.add(normalized)
    }
  }

  return {
    valid: duplicates.length === 0,
    duplicates,
  }
}

/**
 * Parse serial numbers from textarea input (one per line)
 */
export function parseSerialNumbers(input: string): string[] {
  if (!input || input.trim().length === 0) {
    return []
  }

  return input
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
}

/**
 * Parse manual codes from textarea input (one per line)
 */
export function parseManualCodes(input: string): string[] {
  if (!input || input.trim().length === 0) {
    return []
  }

  return input
    .split('\n')
    .map(line => line.trim().toUpperCase())
    .filter(line => line.length > 0)
}

/**
 * Validate that all codes follow the expected pattern
 * Pattern: {FAMILY}-{TYPE}-{MODE}-{YEAR}-{SEQUENCE}
 */
export function validateCodePattern(code: string): boolean {
  const pattern = /^[A-Z0-9]{2,10}-[A-Z0-9]{2,10}-[A-Z]{3}-\d{4}-\d{4,5}$/
  return pattern.test(code)
}

/**
 * Validate all manual codes follow the pattern
 */
export function validateManualCodesPattern(codes: string[]): {
  valid: boolean
  invalidCodes: string[]
} {
  const invalidCodes = codes.filter(code => !validateCodePattern(code))

  return {
    valid: invalidCodes.length === 0,
    invalidCodes,
  }
}
