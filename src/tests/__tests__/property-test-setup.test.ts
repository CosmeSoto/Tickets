/**
 * Verificación de configuración de pruebas basadas en propiedades
 * Asegura que fast-check esté configurado correctamente y los arbitrarios funcionen como se espera
 */

import * as fc from 'fast-check'
import {
  equipmentArbitrary,
  bulkEquipmentInputArbitrary,
  bulkEquipmentInputAutoArbitrary,
  bulkEquipmentInputManualArbitrary,
  sequentialCodesArbitrary,
  equipmentCodeArbitrary,
} from '../arbitraries/equipment'
import {
  runPropertyTest,
  propertyTestTag,
  PROPERTY_TEST_PARAMS,
} from '../helpers/property-test-config'

describe('Configuración de Pruebas Basadas en Propiedades', () => {
  describe('Configuración de fast-check', () => {
    it('debe ejecutar con mínimo 100 iteraciones', () => {
      expect(PROPERTY_TEST_PARAMS.numRuns).toBeGreaterThanOrEqual(100)
    })

    it('debe ejecutar pruebas de propiedades exitosamente', () => {
      runPropertyTest(fc.integer(), n => {
        expect(typeof n).toBe('number')
      })
    })
  })

  describe('Arbitrarios de equipos', () => {
    it('debe generar items de equipo válidos', () => {
      runPropertyTest(equipmentArbitrary(), equipment => {
        expect(equipment).toHaveProperty('id')
        expect(equipment).toHaveProperty('code')
        expect(equipment).toHaveProperty('brand')
        expect(equipment).toHaveProperty('model')
        expect(equipment).toHaveProperty('type')
        expect(equipment).toHaveProperty('condition')
        expect(equipment.type).toHaveProperty('id')
        expect(equipment.type).toHaveProperty('name')
        expect(equipment.type).toHaveProperty('code')
      })
    })

    it('debe generar códigos de equipo válidos', () => {
      runPropertyTest(equipmentCodeArbitrary(), code => {
        // Patrón: {FAMILIA}-{TIPO}-{MODO}-{AÑO}-{SECUENCIA}
        const pattern = /^[A-Z]{2,6}-[A-Z]{2,6}-(OWN|LEA|REN|DON)-\d{4}-\d{5}$/
        expect(code).toMatch(pattern)
      })
    })

    it('debe generar códigos secuenciales correctamente', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), quantity => {
          const codes = fc.sample(sequentialCodesArbitrary(quantity), 1)[0]

          expect(codes).toHaveLength(quantity)

          // Todos los códigos deben tener el mismo prefijo
          if (quantity > 1) {
            const firstPrefix = codes[0].substring(0, codes[0].lastIndexOf('-'))
            for (const code of codes) {
              const prefix = code.substring(0, code.lastIndexOf('-'))
              expect(prefix).toBe(firstPrefix)
            }

            // Las secuencias deben ser consecutivas
            const sequences = codes.map(code => {
              const parts = code.split('-')
              return parseInt(parts[parts.length - 1], 10)
            })

            for (let i = 1; i < sequences.length; i++) {
              expect(sequences[i]).toBe(sequences[i - 1] + 1)
            }
          }
        }),
        PROPERTY_TEST_PARAMS
      )
    })
  })

  describe('Arbitrarios de entrada de equipos por lote', () => {
    it('debe generar entradas de lote en modo automático válidas', () => {
      runPropertyTest(bulkEquipmentInputAutoArbitrary(), input => {
        expect(input.codeMode).toBe('auto')
        expect(input.manualCodes).toBeUndefined()
        expect(input.quantity).toBeGreaterThanOrEqual(1)
        expect(input.quantity).toBeLessThanOrEqual(100)
        expect(input).toHaveProperty('brand')
        expect(input).toHaveProperty('model')
        expect(input).toHaveProperty('typeId')
        expect(input).toHaveProperty('departmentId')
        expect(input).toHaveProperty('condition')
        expect(input).toHaveProperty('ownershipType')
      })
    })

    it('debe generar entradas de lote en modo manual válidas', () => {
      runPropertyTest(bulkEquipmentInputManualArbitrary(), input => {
        expect(input.codeMode).toBe('manual')
        expect(input.manualCodes).toBeDefined()
        expect(input.manualCodes?.length).toBe(input.quantity)
        expect(input.quantity).toBeGreaterThanOrEqual(1)
        expect(input.quantity).toBeLessThanOrEqual(100)

        // Todos los códigos manuales deben seguir el patrón
        if (input.manualCodes) {
          const pattern = /^[A-Z]{2,6}-[A-Z]{2,6}-(OWN|LEA|REN|DON)-\d{4}-\d{5}$/
          for (const code of input.manualCodes) {
            expect(code).toMatch(pattern)
          }
        }
      })
    })

    it('debe generar entradas de lote válidas (modos mixtos)', () => {
      runPropertyTest(bulkEquipmentInputArbitrary(), input => {
        expect(['auto', 'manual']).toContain(input.codeMode)
        expect(input.quantity).toBeGreaterThanOrEqual(1)
        expect(input.quantity).toBeLessThanOrEqual(100)

        // Si es modo manual, manualCodes debe coincidir con quantity
        if (input.codeMode === 'manual') {
          expect(input.manualCodes).toBeDefined()
          expect(input.manualCodes?.length).toBe(input.quantity)
        }

        // Si se proporcionan serialNumbers y no están vacíos, deben coincidir con quantity
        if (input.serialNumbers && input.serialNumbers.length > 0) {
          expect(input.serialNumbers.length).toBe(input.quantity)
        }
      })
    })
  })

  describe('Etiquetado de pruebas de propiedades', () => {
    it(propertyTestTag('feature-prueba', 1, 'Propiedad de Ejemplo'), () => {
      // Esta prueba verifica que el helper de etiquetado funciona
      expect(true).toBe(true)
    })
  })
})
