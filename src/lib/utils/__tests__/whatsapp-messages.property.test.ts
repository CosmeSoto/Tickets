/**
 * Pruebas basadas en propiedades para generación de mensajes de WhatsApp
 * Valida que los mensajes cumplan con las especificaciones de formato
 */

import * as fc from 'fast-check'
import {
  generateGroupContactMessage,
  generateUnitContactMessage,
  generateMultipleItemsMessage,
  generateWhatsAppUrl,
  messageDoesNotContainEquipmentCode,
  messageContainsEquipmentCode,
} from '../whatsapp-messages'
import { equipmentArbitrary } from '@/tests/arbitraries/equipment'
import {
  runPropertyTest,
  propertyTestTag,
  validatesRequirements,
} from '@/tests/helpers/property-test-config'
import type { EquipmentGroup } from '@/types/equipment-grouping'

describe(
  propertyTestTag('inventory-quantity-management', 2, 'Formato de Mensaje de Contacto de Grupo'),
  () => {
    describe(validatesRequirements('1.5'), () => {
      it('debe referenciar marca y modelo pero NO códigos específicos', () => {
        runPropertyTest(
          fc
            .array(equipmentArbitrary(), { minLength: 1, maxLength: 10 })
            .map((units): EquipmentGroup => {
              const first = units[0]
              return {
                groupId: 'test-group',
                brand: first.brand,
                model: first.model,
                type: first.type,
                condition: first.condition,
                saleListingPrice: first.saleListingPrice,
                photoUrl: first.photoUrl,
                specifications: first.specifications,
                units,
                availableUnits: units.length,
                createdAt: first.createdAt,
                updatedAt: new Date(),
              }
            }),
          group => {
            const message = generateGroupContactMessage(group)

            // El mensaje DEBE contener marca y modelo
            expect(message).toContain(group.brand)
            expect(message).toContain(group.model)

            // El mensaje NO DEBE contener códigos específicos de equipos
            expect(messageDoesNotContainEquipmentCode(message)).toBe(true)

            // Verificar que ningún código de las unidades esté en el mensaje
            for (const unit of group.units) {
              expect(message).not.toContain(unit.code)
            }
          }
        )
      })

      it('debe incluir el tipo de equipo', () => {
        runPropertyTest(
          fc
            .array(equipmentArbitrary(), { minLength: 1, maxLength: 10 })
            .map((units): EquipmentGroup => {
              const first = units[0]
              return {
                groupId: 'test-group',
                brand: first.brand,
                model: first.model,
                type: first.type,
                condition: first.condition,
                saleListingPrice: first.saleListingPrice,
                photoUrl: first.photoUrl,
                specifications: first.specifications,
                units,
                availableUnits: units.length,
                createdAt: first.createdAt,
                updatedAt: new Date(),
              }
            }),
          group => {
            const message = generateGroupContactMessage(group)
            expect(message).toContain(group.type.name)
          }
        )
      })

      it('debe incluir la condición del equipo', () => {
        runPropertyTest(
          fc
            .array(equipmentArbitrary(), { minLength: 1, maxLength: 10 })
            .map((units): EquipmentGroup => {
              const first = units[0]
              return {
                groupId: 'test-group',
                brand: first.brand,
                model: first.model,
                type: first.type,
                condition: first.condition,
                saleListingPrice: first.saleListingPrice,
                photoUrl: first.photoUrl,
                specifications: first.specifications,
                units,
                availableUnits: units.length,
                createdAt: first.createdAt,
                updatedAt: new Date(),
              }
            }),
          group => {
            const message = generateGroupContactMessage(group)
            expect(message).toContain('Condición:')
          }
        )
      })

      it('debe incluir el precio cuando está disponible', () => {
        runPropertyTest(
          fc
            .array(equipmentArbitrary(), { minLength: 1, maxLength: 10 })
            .map((units): EquipmentGroup => {
              const first = units[0]
              return {
                groupId: 'test-group',
                brand: first.brand,
                model: first.model,
                type: first.type,
                condition: first.condition,
                saleListingPrice: 1000, // Precio fijo para la prueba
                photoUrl: first.photoUrl,
                specifications: first.specifications,
                units,
                availableUnits: units.length,
                createdAt: first.createdAt,
                updatedAt: new Date(),
              }
            }),
          group => {
            const message = generateGroupContactMessage(group)
            expect(message).toContain('Precio:')
            expect(message).toContain('$')
          }
        )
      })

      it('debe indicar cantidad de unidades cuando hay más de una', () => {
        runPropertyTest(
          fc
            .array(equipmentArbitrary(), { minLength: 2, maxLength: 10 })
            .map((units): EquipmentGroup => {
              const first = units[0]
              return {
                groupId: 'test-group',
                brand: first.brand,
                model: first.model,
                type: first.type,
                condition: first.condition,
                saleListingPrice: first.saleListingPrice,
                photoUrl: first.photoUrl,
                specifications: first.specifications,
                units,
                availableUnits: units.length,
                createdAt: first.createdAt,
                updatedAt: new Date(),
              }
            }),
          group => {
            const message = generateGroupContactMessage(group)
            expect(message).toContain(`${group.availableUnits} unidades disponibles`)
          }
        )
      })
    })
  }
)

describe(
  propertyTestTag('inventory-quantity-management', 3, 'Formato de Mensaje de Contacto de Unidad'),
  () => {
    describe(validatesRequirements('1.6'), () => {
      it('debe incluir el código específico del equipo', () => {
        runPropertyTest(equipmentArbitrary(), unit => {
          const message = generateUnitContactMessage(unit)

          // El mensaje DEBE contener el código específico
          expect(messageContainsEquipmentCode(message, unit.code)).toBe(true)
          expect(message).toContain(unit.code)
        })
      })

      it('debe incluir marca, modelo y tipo', () => {
        runPropertyTest(equipmentArbitrary(), unit => {
          const message = generateUnitContactMessage(unit)

          expect(message).toContain(unit.brand)
          expect(message).toContain(unit.model)
          expect(message).toContain(unit.type.name)
        })
      })

      it('debe incluir número de serie cuando está disponible', () => {
        runPropertyTest(
          equipmentArbitrary().filter(unit => unit.serialNumber.trim().length > 0),
          unit => {
            const message = generateUnitContactMessage(unit)
            expect(message).toContain(unit.serialNumber)
          }
        )
      })

      it('debe incluir la condición del equipo', () => {
        runPropertyTest(equipmentArbitrary(), unit => {
          const message = generateUnitContactMessage(unit)
          expect(message).toContain('Condición:')
        })
      })

      it('debe incluir el precio cuando está disponible', () => {
        runPropertyTest(
          equipmentArbitrary().map(unit => ({ ...unit, saleListingPrice: 1000 })),
          unit => {
            const message = generateUnitContactMessage(unit)
            expect(message).toContain('Precio:')
            expect(message).toContain('$')
          }
        )
      })

      it('debe tener formato diferente al mensaje de grupo', () => {
        runPropertyTest(
          fc
            .array(equipmentArbitrary(), { minLength: 2, maxLength: 5 })
            .map((units): { group: EquipmentGroup; unit: (typeof units)[0] } => {
              const first = units[0]
              return {
                group: {
                  groupId: 'test-group',
                  brand: first.brand,
                  model: first.model,
                  type: first.type,
                  condition: first.condition,
                  saleListingPrice: first.saleListingPrice,
                  photoUrl: first.photoUrl,
                  specifications: first.specifications,
                  units,
                  availableUnits: units.length,
                  createdAt: first.createdAt,
                  updatedAt: new Date(),
                },
                unit: first,
              }
            }),
          ({ group, unit }) => {
            const groupMessage = generateGroupContactMessage(group)
            const unitMessage = generateUnitContactMessage(unit)

            // Los mensajes deben ser diferentes
            expect(groupMessage).not.toBe(unitMessage)

            // El mensaje de grupo NO debe contener el código
            expect(messageDoesNotContainEquipmentCode(groupMessage)).toBe(true)

            // El mensaje de unidad SÍ debe contener el código
            expect(messageContainsEquipmentCode(unitMessage, unit.code)).toBe(true)
          }
        )
      })
    })
  }
)

describe('Generación de URL de WhatsApp', () => {
  it('debe generar URL válida con mensaje codificado', () => {
    runPropertyTest(
      fc.tuple(
        fc.stringMatching(/^\+52[0-9]{10}$/), // Número de teléfono mexicano
        fc.string({ minLength: 1, maxLength: 200 }) // Mensaje
      ),
      ([phone, message]) => {
        const url = generateWhatsAppUrl(phone, message)

        // Debe ser una URL válida de WhatsApp
        expect(url).toContain('https://wa.me/')
        expect(url).toContain('?text=')

        // Debe contener el número de teléfono
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
        expect(url).toContain(cleanPhone)
      }
    )
  })

  it('debe codificar correctamente caracteres especiales', () => {
    const phone = '+525512345678'
    const message = 'Hola, ¿cómo estás? Precio: $1,000.00'
    const url = generateWhatsAppUrl(phone, message)

    // Los caracteres especiales deben estar codificados
    expect(url).not.toContain('¿')
    expect(url).not.toContain('$')
    expect(url).not.toContain(',')
    expect(url).toContain('%')
  })
})

describe('Mensaje de múltiples items', () => {
  it('debe listar todos los equipos con sus códigos', () => {
    runPropertyTest(fc.array(equipmentArbitrary(), { minLength: 2, maxLength: 5 }), items => {
      const message = generateMultipleItemsMessage(items)

      // Debe contener todos los códigos
      for (const item of items) {
        expect(message).toContain(item.code)
        expect(message).toContain(item.brand)
        expect(message).toContain(item.model)
      }
    })
  })

  it('debe numerar los items secuencialmente', () => {
    runPropertyTest(fc.array(equipmentArbitrary(), { minLength: 2, maxLength: 5 }), items => {
      const message = generateMultipleItemsMessage(items)

      // Debe contener números del 1 al N
      for (let i = 1; i <= items.length; i++) {
        expect(message).toContain(`${i}.`)
      }
    })
  })

  it('debe usar mensaje de unidad individual cuando solo hay un item', () => {
    runPropertyTest(equipmentArbitrary(), item => {
      const multiMessage = generateMultipleItemsMessage([item])
      const singleMessage = generateUnitContactMessage(item)

      expect(multiMessage).toBe(singleMessage)
    })
  })

  it('debe manejar array vacío correctamente', () => {
    const message = generateMultipleItemsMessage([])
    expect(message).toBeTruthy()
    expect(message.length).toBeGreaterThan(0)
  })
})
