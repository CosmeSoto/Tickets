/**
 * Arbitrarios de fast-check para pruebas basadas en propiedades de equipos
 * Genera datos de prueba para agrupación de equipos y creación por lote
 */

import * as fc from 'fast-check'
import { EquipmentCondition, EquipmentStatus, OwnershipType } from '@prisma/client'
import type { PublicEquipmentItem, BulkEquipmentInput } from '@/types/equipment-grouping'

/**
 * Arbitrario para el enum de condición de equipo
 */
export const equipmentConditionArbitrary = (): fc.Arbitrary<EquipmentCondition> =>
  fc.constantFrom<EquipmentCondition>('NEW', 'NEW', 'USED', 'USED', 'DAMAGED')

/**
 * Arbitrario para el enum de estado de equipo
 */
export const equipmentStatusArbitrary = (): fc.Arbitrary<EquipmentStatus> =>
  fc.constantFrom<EquipmentStatus>(
    'AVAILABLE',
    'ASSIGNED',
    'MAINTENANCE',
    'FOR_SALE',
    'SOLD',
    'RETIRED'
  )

/**
 * Arbitrario para el enum de tipo de propiedad
 */
export const ownershipTypeArbitrary = (): fc.Arbitrary<OwnershipType> =>
  fc.constantFrom<OwnershipType>('FIXED_ASSET', 'RENTAL', 'LOAN')

/**
 * Arbitrario para código de equipo siguiendo el patrón: {FAMILIA}-{TIPO}-{MODO}-{AÑO}-{SEC}
 */
export const equipmentCodeArbitrary = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.stringMatching(/^[A-Z]{2,6}$/), // FAMILY (2-6 uppercase letters)
      fc.stringMatching(/^[A-Z]{2,6}$/), // TYPE (2-6 uppercase letters)
      fc.constantFrom('OWN', 'LEA', 'REN', 'DON'), // MODE (ownership mode)
      fc.integer({ min: 2020, max: 2030 }), // YEAR
      fc.integer({ min: 1, max: 99999 }) // SEQUENCE
    )
    .map(([family, type, mode, year, seq]) => {
      const paddedSeq = seq.toString().padStart(5, '0')
      return `${family}-${type}-${mode}-${year}-${paddedSeq}`
    })

/**
 * Arbitrario para nombres de marca
 */
export const brandArbitrary = (): fc.Arbitrary<string> =>
  fc.constantFrom(
    'Dell',
    'HP',
    'Lenovo',
    'Apple',
    'Asus',
    'Acer',
    'Samsung',
    'LG',
    'Sony',
    'Microsoft'
  )

/**
 * Arbitrario para nombres de modelo
 */
export const modelArbitrary = (): fc.Arbitrary<string> =>
  fc.constantFrom(
    'Latitude 5420',
    'ThinkPad X1',
    'MacBook Pro',
    'EliteBook 840',
    'Inspiron 15',
    'Pavilion 14',
    'ZenBook 13',
    'Surface Pro 9',
    'Galaxy Book',
    'Gram 17'
  )

/**
 * Arbitrario para tipo de equipo
 */
export const equipmentTypeArbitrary = () =>
  fc.record({
    id: fc.uuid(),
    name: fc.constantFrom('Laptop', 'Desktop', 'Monitor', 'Printer', 'Tablet', 'Phone'),
    code: fc.stringMatching(/^[A-Z]{3,6}$/),
    family: fc.option(
      fc.record({
        id: fc.uuid(),
        name: fc.constantFrom('Tecnología', 'Mobiliario', 'Vehículos', 'Herramientas'),
        icon: fc.option(fc.constantFrom('laptop', 'desktop', 'monitor', 'printer'), {
          nil: null,
        }),
        color: fc.option(fc.constantFrom('#3b82f6', '#10b981', '#f59e0b', '#ef4444'), {
          nil: null,
        }),
      }),
      { nil: null }
    ),
  })

/**
 * Arbitrario para PublicEquipmentItem
 * Genera items de equipo para pruebas de agrupación
 */
export const equipmentArbitrary = (): fc.Arbitrary<PublicEquipmentItem> =>
  fc.record({
    id: fc.uuid(),
    code: equipmentCodeArbitrary(),
    serialNumber: fc.oneof(fc.constant(''), fc.stringMatching(/^[A-Z0-9]{8,20}$/)),
    brand: brandArbitrary(),
    model: modelArbitrary(),
    type: equipmentTypeArbitrary(),
    condition: equipmentConditionArbitrary(),
    saleListingPrice: fc.option(fc.float({ min: 100, max: 10000, noNaN: true }), { nil: null }),
    photoUrl: fc.option(fc.webUrl(), { nil: null }),
    specifications: fc.option(
      fc.dictionary(
        fc.constantFrom('RAM', 'Storage', 'Processor', 'Screen', 'Graphics'),
        fc.oneof(fc.string(), fc.integer(), fc.boolean())
      ),
      { nil: null }
    ),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') }),
  })

/**
 * Arbitrario para array de equipos con agrupación controlada
 * Útil para probar lógica de agrupación con tamaños de grupo conocidos
 */
export const equipmentArrayWithGroupsArbitrary = (
  minGroups: number = 1,
  maxGroups: number = 10,
  minUnitsPerGroup: number = 1,
  maxUnitsPerGroup: number = 10
): fc.Arbitrary<PublicEquipmentItem[]> =>
  fc
    .array(
      fc.tuple(
        fc.integer({ min: minUnitsPerGroup, max: maxUnitsPerGroup }), // units per group
        brandArbitrary(),
        modelArbitrary(),
        equipmentTypeArbitrary(),
        equipmentConditionArbitrary(),
        fc.option(fc.float({ min: 100, max: 10000, noNaN: true }), { nil: null })
      ),
      { minLength: minGroups, maxLength: maxGroups }
    )
    .chain(groups =>
      fc
        .shuffledSubarray(
          groups.flatMap(([count, brand, model, type, condition, price]) =>
            Array.from({ length: count }, () =>
              fc.record({
                id: fc.uuid(),
                code: equipmentCodeArbitrary(),
                serialNumber: fc.oneof(fc.constant(''), fc.stringMatching(/^[A-Z0-9]{8,20}$/)),
                brand: fc.constant(brand),
                model: fc.constant(model),
                type: fc.constant(type),
                condition: fc.constant(condition),
                saleListingPrice: fc.constant(price),
                photoUrl: fc.option(fc.webUrl(), { nil: null }),
                specifications: fc.option(
                  fc.dictionary(
                    fc.constantFrom('RAM', 'Storage', 'Processor'),
                    fc.oneof(fc.string(), fc.integer())
                  ),
                  { nil: null }
                ),
                createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') }),
              })
            )
          ),
          { minLength: 1 }
        )
        .chain(records => fc.tuple(...records))
    )

/**
 * Arbitrario para BulkEquipmentInput con códigos auto-generados
 */
export const bulkEquipmentInputAutoArbitrary = (): fc.Arbitrary<BulkEquipmentInput> =>
  fc.integer({ min: 1, max: 100 }).chain(quantity =>
    fc.record({
      quantity: fc.constant(quantity),
      codeMode: fc.constant('auto' as const),
      manualCodes: fc.constant(undefined),
      serialNumbers: fc.option(
        fc.oneof(
          // Either empty array or array matching quantity
          fc.constant([] as string[]),
          fc.array(fc.stringMatching(/^[A-Z0-9]{8,20}$/), {
            minLength: quantity,
            maxLength: quantity,
          })
        ),
        { nil: undefined }
      ),
      modelId: fc.uuid(),
      brand: brandArbitrary(),
      model: modelArbitrary(),
      typeId: fc.uuid(),
      departmentId: fc.uuid(),
      condition: equipmentConditionArbitrary(),
      ownershipType: ownershipTypeArbitrary(),
      purchasePrice: fc.option(fc.float({ min: 100, max: 50000, noNaN: true }), {
        nil: undefined,
      }),
      supplierId: fc.option(fc.uuid(), { nil: undefined }),
      purchaseDate: fc.option(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') }),
        { nil: undefined }
      ),
      specifications: fc.option(
        fc.dictionary(
          fc.constantFrom('RAM', 'Storage', 'Processor', 'Screen'),
          fc.oneof(fc.string(), fc.integer())
        ),
        { nil: undefined }
      ),
      accessories: fc.option(
        fc.array(fc.constantFrom('Mouse', 'Keyboard', 'Charger', 'Bag', 'Cable'), {
          maxLength: 5,
        }),
        { nil: undefined }
      ),
      notes: fc.option(fc.lorem({ maxCount: 50 }), { nil: undefined }),
      photoUrl: fc.option(fc.webUrl(), { nil: undefined }),
      warehouseId: fc.option(fc.uuid(), { nil: undefined }),
    })
  )

/**
 * Arbitrario para BulkEquipmentInput con códigos manuales
 */
export const bulkEquipmentInputManualArbitrary = (): fc.Arbitrary<BulkEquipmentInput> =>
  fc.integer({ min: 1, max: 100 }).chain(quantity =>
    fc.record({
      quantity: fc.constant(quantity),
      codeMode: fc.constant('manual' as const),
      manualCodes: fc.array(equipmentCodeArbitrary(), {
        minLength: quantity,
        maxLength: quantity,
      }),
      serialNumbers: fc.option(
        fc.array(fc.stringMatching(/^[A-Z0-9]{8,20}$/), {
          minLength: quantity,
          maxLength: quantity,
        }),
        { nil: undefined }
      ),
      modelId: fc.uuid(),
      brand: brandArbitrary(),
      model: modelArbitrary(),
      typeId: fc.uuid(),
      departmentId: fc.uuid(),
      condition: equipmentConditionArbitrary(),
      ownershipType: ownershipTypeArbitrary(),
      purchasePrice: fc.option(fc.float({ min: 100, max: 50000, noNaN: true }), {
        nil: undefined,
      }),
      supplierId: fc.option(fc.uuid(), { nil: undefined }),
      purchaseDate: fc.option(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') }),
        { nil: undefined }
      ),
      specifications: fc.option(
        fc.dictionary(
          fc.constantFrom('RAM', 'Storage', 'Processor', 'Screen'),
          fc.oneof(fc.string(), fc.integer())
        ),
        { nil: undefined }
      ),
      accessories: fc.option(
        fc.array(fc.constantFrom('Mouse', 'Keyboard', 'Charger', 'Bag', 'Cable'), {
          maxLength: 5,
        }),
        { nil: undefined }
      ),
      notes: fc.option(fc.lorem({ maxCount: 50 }), { nil: undefined }),
      photoUrl: fc.option(fc.webUrl(), { nil: undefined }),
      warehouseId: fc.option(fc.uuid(), { nil: undefined }),
    })
  )

/**
 * Arbitrario para BulkEquipmentInput (modos automático y manual)
 */
export const bulkEquipmentInputArbitrary = (): fc.Arbitrary<BulkEquipmentInput> =>
  fc.oneof(bulkEquipmentInputAutoArbitrary(), bulkEquipmentInputManualArbitrary())

/**
 * Arbitrario para array de códigos secuenciales
 * Genera N códigos consecutivos con el mismo prefijo
 */
export const sequentialCodesArbitrary = (quantity: number): fc.Arbitrary<string[]> =>
  fc
    .tuple(
      fc.stringMatching(/^[A-Z]{2,6}$/), // FAMILY
      fc.stringMatching(/^[A-Z]{2,6}$/), // TYPE
      fc.constantFrom('OWN', 'LEA', 'REN', 'DON'), // MODE
      fc.integer({ min: 2020, max: 2030 }), // YEAR
      fc.integer({ min: 1, max: 99999 - quantity }) // Starting SEQUENCE
    )
    .map(([family, type, mode, year, startSeq]) =>
      Array.from({ length: quantity }, (_, i) => {
        const seq = startSeq + i
        const paddedSeq = seq.toString().padStart(5, '0')
        return `${family}-${type}-${mode}-${year}-${paddedSeq}`
      })
    )
