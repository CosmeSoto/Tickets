/**
 * Pruebas basadas en propiedades para el servicio de agrupación de equipos
 * Valida las propiedades de correctitud del algoritmo de agrupación
 */

import * as fc from 'fast-check'
import { groupByModel, filterGroups, sortGroups } from '../equipment-grouping.service'
import { equipmentArbitrary } from '@/tests/arbitraries/equipment'
import {
  runPropertyTest,
  propertyTestTag,
  validatesRequirements,
} from '@/tests/helpers/property-test-config'
import { extractGroupingCriteria, generateGroupId } from '@/types/equipment-grouping'

describe(
  propertyTestTag('inventory-quantity-management', 1, 'Consistencia de Agrupación de Equipos'),
  () => {
    describe(validatesRequirements('1.1', '1.8'), () => {
      it('debe preservar todos los items al agrupar', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 100 }),
          equipment => {
            const groups = groupByModel(equipment)

            // La suma de unidades en todos los grupos debe ser igual al total de items
            const totalUnits = groups.reduce((sum, group) => sum + group.units.length, 0)
            expect(totalUnits).toBe(equipment.length)
          }
        )
      })

      it('debe agrupar items con criterios idénticos en el mismo grupo', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 100 }),
          equipment => {
            const groups = groupByModel(equipment)

            // Verificar que todos los items en cada grupo tienen criterios idénticos
            for (const group of groups) {
              const firstItem = group.units[0]
              const firstCriteria = extractGroupingCriteria(firstItem)

              for (const unit of group.units) {
                const unitCriteria = extractGroupingCriteria(unit)

                expect(unitCriteria.brand).toBe(firstCriteria.brand)
                expect(unitCriteria.model).toBe(firstCriteria.model)
                expect(unitCriteria.typeId).toBe(firstCriteria.typeId)
                expect(unitCriteria.condition).toBe(firstCriteria.condition)
                expect(unitCriteria.saleListingPrice).toBe(firstCriteria.saleListingPrice)
              }
            }
          }
        )
      })

      it('debe asignar cada item a exactamente un grupo', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 100 }),
          equipment => {
            const groups = groupByModel(equipment)

            // Crear un Set con todos los IDs de los items originales
            const originalIds = new Set(equipment.map(e => e.id))

            // Crear un Set con todos los IDs de los items en los grupos
            const groupedIds = new Set<string>()
            for (const group of groups) {
              for (const unit of group.units) {
                // Verificar que el ID no esté duplicado
                expect(groupedIds.has(unit.id)).toBe(false)
                groupedIds.add(unit.id)
              }
            }

            // Verificar que todos los IDs originales estén en los grupos
            expect(groupedIds.size).toBe(originalIds.size)
            for (const id of originalIds) {
              expect(groupedIds.has(id)).toBe(true)
            }
          }
        )
      })

      it('debe generar groupId consistente para items con mismos criterios', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 100 }),
          equipment => {
            const groups = groupByModel(equipment)

            for (const group of groups) {
              // Todos los items del grupo deben generar el mismo groupId
              for (const unit of group.units) {
                const criteria = extractGroupingCriteria(unit)
                const expectedGroupId = generateGroupId(criteria)
                expect(group.groupId).toBe(expectedGroupId)
              }
            }
          }
        )
      })

      it('debe calcular availableUnits correctamente', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 100 }),
          equipment => {
            const groups = groupByModel(equipment)

            for (const group of groups) {
              // availableUnits debe ser igual a la cantidad de unidades en el grupo
              expect(group.availableUnits).toBe(group.units.length)
              expect(group.availableUnits).toBeGreaterThan(0)
            }
          }
        )
      })

      it('debe usar datos del primer item como representante del grupo', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 100 }),
          equipment => {
            const groups = groupByModel(equipment)

            for (const group of groups) {
              const firstUnit = group.units[0]

              // Los datos comunes del grupo deben coincidir con el primer item
              expect(group.brand).toBe(firstUnit.brand)
              expect(group.model).toBe(firstUnit.model)
              expect(group.type.id).toBe(firstUnit.type.id)
              expect(group.condition).toBe(firstUnit.condition)
              expect(group.saleListingPrice).toBe(firstUnit.saleListingPrice)
              expect(group.photoUrl).toBe(firstUnit.photoUrl)
            }
          }
        )
      })

      it('debe manejar correctamente arrays vacíos', () => {
        const groups = groupByModel([])
        expect(groups).toEqual([])
      })

      it('debe manejar correctamente un solo item', () => {
        runPropertyTest(equipmentArbitrary(), equipment => {
          const groups = groupByModel([equipment])

          expect(groups).toHaveLength(1)
          expect(groups[0].units).toHaveLength(1)
          expect(groups[0].units[0].id).toBe(equipment.id)
          expect(groups[0].availableUnits).toBe(1)
        })
      })
    })

    describe('Filtrado de grupos', () => {
      it('debe retornar todos los grupos cuando no hay filtros', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 50 }),
          equipment => {
            const groups = groupByModel(equipment)
            const filtered = filterGroups(groups)

            expect(filtered.length).toBe(groups.length)
          }
        )
      })

      it('debe filtrar por término de búsqueda correctamente', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 50 }),
          equipment => {
            const groups = groupByModel(equipment)

            if (groups.length > 0) {
              const searchTerm = groups[0].brand.substring(0, 3).toLowerCase()
              const filtered = filterGroups(groups, searchTerm)

              // Todos los grupos filtrados deben contener el término de búsqueda
              for (const group of filtered) {
                const matchesBrand = group.brand.toLowerCase().includes(searchTerm)
                const matchesModel = group.model.toLowerCase().includes(searchTerm)
                const matchesType = group.type.name.toLowerCase().includes(searchTerm)

                expect(matchesBrand || matchesModel || matchesType).toBe(true)
              }
            }
          }
        )
      })

      it('debe filtrar por familyId correctamente', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 50 }),
          equipment => {
            const groups = groupByModel(equipment)

            if (groups.length > 0 && groups[0].type.family) {
              const familyId = groups[0].type.family.id
              const filtered = filterGroups(groups, undefined, familyId)

              // Todos los grupos filtrados deben tener la misma familia
              for (const group of filtered) {
                expect(group.type.family?.id).toBe(familyId)
              }
            }
          }
        )
      })

      it('debe filtrar por typeId correctamente', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 50 }),
          equipment => {
            const groups = groupByModel(equipment)

            if (groups.length > 0) {
              const typeId = groups[0].type.id
              const filtered = filterGroups(groups, undefined, undefined, typeId)

              // Todos los grupos filtrados deben tener el mismo tipo
              for (const group of filtered) {
                expect(group.type.id).toBe(typeId)
              }
            }
          }
        )
      })
    })

    describe('Ordenamiento de grupos', () => {
      it('debe ordenar por marca correctamente', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 2, maxLength: 50 }),
          equipment => {
            const groups = groupByModel(equipment)

            if (groups.length > 1) {
              const sortedAsc = sortGroups(groups, 'brand', 'asc')
              const sortedDesc = sortGroups(groups, 'brand', 'desc')

              // Verificar orden ascendente
              for (let i = 1; i < sortedAsc.length; i++) {
                expect(
                  sortedAsc[i].brand.localeCompare(sortedAsc[i - 1].brand)
                ).toBeGreaterThanOrEqual(0)
              }

              // Verificar orden descendente
              for (let i = 1; i < sortedDesc.length; i++) {
                expect(
                  sortedDesc[i].brand.localeCompare(sortedDesc[i - 1].brand)
                ).toBeLessThanOrEqual(0)
              }
            }
          }
        )
      })

      it('debe ordenar por availableUnits correctamente', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 2, maxLength: 50 }),
          equipment => {
            const groups = groupByModel(equipment)

            if (groups.length > 1) {
              const sortedAsc = sortGroups(groups, 'availableUnits', 'asc')
              const sortedDesc = sortGroups(groups, 'availableUnits', 'desc')

              // Verificar orden ascendente
              for (let i = 1; i < sortedAsc.length; i++) {
                expect(sortedAsc[i].availableUnits).toBeGreaterThanOrEqual(
                  sortedAsc[i - 1].availableUnits
                )
              }

              // Verificar orden descendente
              for (let i = 1; i < sortedDesc.length; i++) {
                expect(sortedDesc[i].availableUnits).toBeLessThanOrEqual(
                  sortedDesc[i - 1].availableUnits
                )
              }
            }
          }
        )
      })

      it('no debe perder items al ordenar', () => {
        runPropertyTest(
          fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 50 }),
          equipment => {
            const groups = groupByModel(equipment)
            const sorted = sortGroups(groups, 'brand', 'asc')

            // El ordenamiento no debe cambiar la cantidad de grupos
            expect(sorted.length).toBe(groups.length)

            // El ordenamiento no debe cambiar la cantidad total de unidades
            const originalTotal = groups.reduce((sum, g) => sum + g.units.length, 0)
            const sortedTotal = sorted.reduce((sum, g) => sum + g.units.length, 0)
            expect(sortedTotal).toBe(originalTotal)
          }
        )
      })
    })
  }
)
