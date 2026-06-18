/**
 * Pruebas basadas en propiedades para el servicio de generación de códigos secuenciales
 * Valida las propiedades de correctitud del algoritmo de generación de códigos
 */

import * as fc from 'fast-check'
import {
  generateSequentialCodes,
  validateManualCodes,
  getLastSequenceNumber,
  resetSequenceCounter,
} from '../code-generator.service'
import {
  propertyTestTag,
  validatesRequirements,
  PROPERTY_TEST_PARAMS,
} from '@/tests/helpers/property-test-config'
import prisma from '@/lib/prisma'

// Limpiar contadores antes de cada prueba
beforeEach(async () => {
  await prisma.equipment_code_counters.deleteMany({})
})

// Limpiar después de todas las pruebas
afterAll(async () => {
  await prisma.equipment_code_counters.deleteMany({})
  await prisma.$disconnect()
})

describe(
  propertyTestTag(
    'inventory-quantity-management',
    4,
    'Unicidad de Generación de Códigos Secuenciales'
  ),
  () => {
    describe(validatesRequirements('2.5'), () => {
      it('debe generar exactamente N códigos únicos', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 100 }),
            fc.stringMatching(/^[A-Z]{2,6}$/),
            fc.stringMatching(/^[A-Z]{2,6}$/),
            fc.constantFrom('OWNED', 'LEASED', 'RENTED', 'DONATED'),
            async (quantity, familyCode, typeCode, ownershipType) => {
              // Limpiar contador antes de la prueba
              await resetSequenceCounter(familyCode, typeCode, ownershipType as any, 2024)

              const codes = await generateSequentialCodes(
                quantity,
                familyCode,
                typeCode,
                ownershipType as any,
                2024
              )

              // Debe generar exactamente N códigos
              expect(codes).toHaveLength(quantity)

              // Todos los códigos deben ser únicos
              const uniqueCodes = new Set(codes)
              expect(uniqueCodes.size).toBe(quantity)
            }
          ),
          { ...PROPERTY_TEST_PARAMS, numRuns: 20 } // Reducir iteraciones por ser async con DB
        )
      })

      it('debe seguir el patrón correcto de código', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 10 }),
            fc.stringMatching(/^[A-Z]{2,6}$/),
            fc.stringMatching(/^[A-Z]{2,6}$/),
            fc.constantFrom('OWNED', 'LEASED', 'RENTED', 'DONATED'),
            async (quantity, familyCode, typeCode, ownershipType) => {
              await resetSequenceCounter(familyCode, typeCode, ownershipType as any, 2024)

              const codes = await generateSequentialCodes(
                quantity,
                familyCode,
                typeCode,
                ownershipType as any,
                2024
              )

              // Patrón: {FAMILIA}-{TIPO}-{MODO}-{AÑO}-{SECUENCIA}
              const pattern = /^[A-Z]{2,6}-[A-Z]{2,6}-(OWN|LEA|REN|DON)-\d{4}-\d{5}$/

              for (const code of codes) {
                expect(code).toMatch(pattern)
              }
            }
          ),
          { ...PROPERTY_TEST_PARAMS, numRuns: 20 }
        )
      })

      it('debe generar secuencias consecutivas', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 2, max: 20 }),
            fc.stringMatching(/^[A-Z]{2,6}$/),
            fc.stringMatching(/^[A-Z]{2,6}$/),
            fc.constantFrom('OWNED', 'LEASED', 'RENTED', 'DONATED'),
            async (quantity, familyCode, typeCode, ownershipType) => {
              await resetSequenceCounter(familyCode, typeCode, ownershipType as any, 2024)

              const codes = await generateSequentialCodes(
                quantity,
                familyCode,
                typeCode,
                ownershipType as any,
                2024
              )

              // Extraer números de secuencia
              const sequences = codes.map(code => {
                const parts = code.split('-')
                return parseInt(parts[parts.length - 1], 10)
              })

              // Verificar que las secuencias sean consecutivas
              for (let i = 1; i < sequences.length; i++) {
                expect(sequences[i]).toBe(sequences[i - 1] + 1)
              }
            }
          ),
          { ...PROPERTY_TEST_PARAMS, numRuns: 20 }
        )
      })

      it('debe tener el mismo prefijo para todos los códigos del lote', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 2, max: 20 }),
            fc.stringMatching(/^[A-Z]{2,6}$/),
            fc.stringMatching(/^[A-Z]{2,6}$/),
            fc.constantFrom('OWNED', 'LEASED', 'RENTED', 'DONATED'),
            async (quantity, familyCode, typeCode, ownershipType) => {
              await resetSequenceCounter(familyCode, typeCode, ownershipType as any, 2024)

              const codes = await generateSequentialCodes(
                quantity,
                familyCode,
                typeCode,
                ownershipType as any,
                2024
              )

              // Todos los códigos deben tener el mismo prefijo (todo excepto la secuencia)
              const firstPrefix = codes[0].substring(0, codes[0].lastIndexOf('-'))

              for (const code of codes) {
                const prefix = code.substring(0, code.lastIndexOf('-'))
                expect(prefix).toBe(firstPrefix)
              }
            }
          ),
          { ...PROPERTY_TEST_PARAMS, numRuns: 20 }
        )
      })

      it('debe mantener continuidad entre llamadas sucesivas', async () => {
        const familyCode = 'TECH'
        const typeCode = 'LAP'
        const ownershipType = 'OWNED'
        const year = 2024

        await resetSequenceCounter(familyCode, typeCode, ownershipType, year)

        // Primera llamada: generar 5 códigos
        const firstBatch = await generateSequentialCodes(
          5,
          familyCode,
          typeCode,
          ownershipType,
          year
        )

        // Segunda llamada: generar 3 códigos más
        const secondBatch = await generateSequentialCodes(
          3,
          familyCode,
          typeCode,
          ownershipType,
          year
        )

        // Extraer secuencias
        const firstSequences = firstBatch.map(code => {
          const parts = code.split('-')
          return parseInt(parts[parts.length - 1], 10)
        })

        const secondSequences = secondBatch.map(code => {
          const parts = code.split('-')
          return parseInt(parts[parts.length - 1], 10)
        })

        // La primera secuencia del segundo lote debe ser consecutiva a la última del primero
        expect(secondSequences[0]).toBe(firstSequences[firstSequences.length - 1] + 1)
      })

      it('debe manejar correctamente cantidad = 1', async () => {
        const familyCode = 'TECH'
        const typeCode = 'LAP'
        const ownershipType = 'OWNED'
        const year = 2024

        await resetSequenceCounter(familyCode, typeCode, ownershipType, year)

        const codes = await generateSequentialCodes(1, familyCode, typeCode, ownershipType, year)

        expect(codes).toHaveLength(1)
        expect(codes[0]).toMatch(/^TECH-LAP-OWN-2024-\d{5}$/)
      })

      it('debe rechazar cantidades fuera de rango', async () => {
        const familyCode = 'TECH'
        const typeCode = 'LAP'
        const ownershipType = 'OWNED'
        const year = 2024

        // Cantidad 0
        await expect(
          generateSequentialCodes(0, familyCode, typeCode, ownershipType, year)
        ).rejects.toThrow()

        // Cantidad 101
        await expect(
          generateSequentialCodes(101, familyCode, typeCode, ownershipType, year)
        ).rejects.toThrow()

        // Cantidad negativa
        await expect(
          generateSequentialCodes(-5, familyCode, typeCode, ownershipType, year)
        ).rejects.toThrow()
      })

      it('debe actualizar correctamente el contador en la base de datos', async () => {
        const familyCode = 'TECH'
        const typeCode = 'LAP'
        const ownershipType = 'OWNED'
        const year = 2024

        await resetSequenceCounter(familyCode, typeCode, ownershipType, year)

        // Generar 10 códigos
        await generateSequentialCodes(10, familyCode, typeCode, ownershipType, year)

        // Verificar que el contador se actualizó
        const lastSequence = await getLastSequenceNumber(familyCode, typeCode, ownershipType, year)
        expect(lastSequence).toBe(10)
      })
    })

    describe('Validación de códigos manuales', () => {
      it('debe detectar códigos duplicados en la base de datos', async () => {
        // Crear un equipo con un código específico
        const testCode = 'TEST-LAP-OWN-2024-00001'

        const type = await prisma.equipment_types.findFirst({ include: { models: { take: 1 } } })
        if (!type?.models[0]) {
          throw new Error('Se requiere al menos un equipment_model en BD para esta prueba')
        }
        const modelId = type.models[0].id

        await prisma.equipment.create({
          data: {
            code: testCode,
            serialNumber: 'TEST123',
            brand: 'Test Brand',
            modelDeprecated: 'Test Model',
            modelId,
            typeId: type.id,
            departmentId: (await prisma.departments.findFirst())!.id,
            status: 'AVAILABLE',
            condition: 'USED',
            ownershipType: 'FIXED_ASSET',
            qrCode: `EQ-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          },
        })

        // Validar códigos que incluyen el duplicado
        const result = await validateManualCodes([testCode, 'TEST-LAP-OWN-2024-00002'])

        expect(result.valid).toBe(false)
        expect(result.duplicates).toContain(testCode)
        expect(result.duplicates).toHaveLength(1)

        // Limpiar
        await prisma.equipment.deleteMany({ where: { code: testCode } })
      })

      it('debe aprobar códigos únicos', async () => {
        const uniqueCodes = [
          'UNIQUE-LAP-OWN-2024-00001',
          'UNIQUE-LAP-OWN-2024-00002',
          'UNIQUE-LAP-OWN-2024-00003',
        ]

        const result = await validateManualCodes(uniqueCodes)

        expect(result.valid).toBe(true)
        expect(result.duplicates).toHaveLength(0)
      })
    })

    describe('Gestión de contadores', () => {
      it('debe retornar 0 para contadores no existentes', async () => {
        const lastSequence = await getLastSequenceNumber('NONEXIST', 'XXX', 'OWNED', 2024)
        expect(lastSequence).toBe(0)
      })

      it('debe reiniciar correctamente el contador', async () => {
        const familyCode = 'TECH'
        const typeCode = 'LAP'
        const ownershipType = 'OWNED'
        const year = 2024

        // Generar algunos códigos
        await generateSequentialCodes(5, familyCode, typeCode, ownershipType, year)

        // Verificar que el contador está en 5
        let lastSequence = await getLastSequenceNumber(familyCode, typeCode, ownershipType, year)
        expect(lastSequence).toBe(5)

        // Reiniciar contador
        await resetSequenceCounter(familyCode, typeCode, ownershipType, year)

        // Verificar que el contador está en 0
        lastSequence = await getLastSequenceNumber(familyCode, typeCode, ownershipType, year)
        expect(lastSequence).toBe(0)
      })
    })
  }
)
