import { z } from 'zod'

// Schema para equipo individual
export const individualEquipmentSchema = z.object({
  code: z
    .string()
    .min(1, 'El código es requerido')
    .max(50, 'El código no puede exceder 50 caracteres')
    .regex(
      /^[A-Z0-9-_]+$/,
      'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'
    ),

  serialNumber: z
    .string()
    .max(100, 'El número de serie no puede exceder 100 caracteres')
    .optional(),

  modelId: z.string().min(1, 'El modelo es requerido'),

  departmentId: z.string().optional(),

  warehouseId: z.string().optional(),

  physicalLocation: z.string().optional(),

  condition: z
    .enum(['NEW', 'GOOD', 'FAIR', 'POOR'], {
      errorMap: () => ({ message: 'Condición inválida' }),
    })
    .optional(),

  propertyType: z
    .enum(['FIXED_ASSET', 'RENTAL', 'LOAN'], {
      errorMap: () => ({ message: 'Tipo de propiedad inválido' }),
    })
    .optional(),

  purchaseDate: z.string().optional(),

  purchasePrice: z.number().positive('El precio debe ser positivo').optional(),

  customValues: z.record(z.any()).optional(),

  accessories: z
    .array(
      z.object({
        name: z.string().min(1, 'El nombre del accesorio es requerido'),
        quantity: z.number().int().positive('La cantidad debe ser positiva'),
      })
    )
    .optional(),

  notes: z.string().optional(),
})

// Schema para datos comunes del lote
export const batchCommonDataSchema = z.object({
  modelId: z.string().min(1, 'El modelo es requerido'),

  supplierId: z.string().min(1, 'El proveedor es requerido'),

  departmentId: z.string().optional(),

  condition: z.string().optional(),

  propertyType: z.string().optional(),

  purchaseDate: z.string().optional(),

  unitPrice: z.number().positive('El precio unitario debe ser positivo').optional(),

  invoiceNumber: z
    .string()
    .max(100, 'El número de factura no puede exceder 100 caracteres')
    .optional(),

  purchaseOrderNumber: z
    .string()
    .max(100, 'El número de orden de compra no puede exceder 100 caracteres')
    .optional(),

  warehouseId: z.string().optional(),

  customValues: z.record(z.any()).optional(),

  accessories: z
    .array(
      z.object({
        name: z.string().min(1, 'El nombre del accesorio es requerido'),
        quantity: z.number().int().positive('La cantidad debe ser positiva'),
      })
    )
    .optional(),

  notes: z.string().optional(),
})

// Schema para datos individuales del lote
export const batchIndividualDataSchema = z.object({
  code: z
    .string()
    .min(1, 'El código es requerido')
    .max(50, 'El código no puede exceder 50 caracteres')
    .regex(
      /^[A-Z0-9-_]+$/,
      'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'
    ),

  serialNumber: z
    .string()
    .max(100, 'El número de serie no puede exceder 100 caracteres')
    .optional(),

  physicalLocation: z.string().optional(),

  warehouseId: z.string().optional(),
})

// Schema para creación de lote completo
export const batchCreationSchema = z
  .object({
    commonData: batchCommonDataSchema,

    equipmentData: z
      .array(batchIndividualDataSchema)
      .min(2, 'Debe haber al menos 2 equipos en el lote')
      .max(100, 'No se pueden crear más de 100 equipos en un lote'),
  })
  .refine(data => data.equipmentData.length >= 2, {
    message: 'Un lote debe contener al menos 2 equipos',
    path: ['equipmentData'],
  })

export type IndividualEquipmentInput = z.infer<typeof individualEquipmentSchema>
export type BatchCommonDataInput = z.infer<typeof batchCommonDataSchema>
export type BatchIndividualDataInput = z.infer<typeof batchIndividualDataSchema>
export type BatchCreationInput = z.infer<typeof batchCreationSchema>
