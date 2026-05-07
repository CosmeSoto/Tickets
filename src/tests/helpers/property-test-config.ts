/**
 * Configuración y helpers para pruebas basadas en propiedades con fast-check
 * Asegura parámetros de prueba consistentes en todas las pruebas de propiedades
 */

import * as fc from 'fast-check'

/**
 * Parámetros estándar para pruebas basadas en propiedades
 * Todas las pruebas de propiedades DEBEN usar estos parámetros para asegurar mínimo 100 iteraciones
 */
export const PROPERTY_TEST_PARAMS: fc.Parameters<unknown> = {
  numRuns: 100, // Mínimo 100 iteraciones por propiedad
  verbose: false, // Cambiar a true para depuración
  seed: undefined, // Usar undefined para semilla aleatoria, o establecer semilla específica para reproducibilidad
  path: undefined, // Ruta para reproducir un contraejemplo específico
  endOnFailure: false, // Continuar ejecutando todas las pruebas incluso si una falla
}

/**
 * Parámetros para pruebas de propiedades rápidas (menos iteraciones para retroalimentación rápida)
 * Usar solo durante desarrollo, NO para suite de pruebas final
 */
export const FAST_PROPERTY_TEST_PARAMS: fc.Parameters<unknown> = {
  ...PROPERTY_TEST_PARAMS,
  numRuns: 20,
}

/**
 * Parámetros para pruebas de propiedades exhaustivas (más iteraciones para lógica crítica)
 * Usar para lógica de negocio crítica que requiere confianza extra
 */
export const EXHAUSTIVE_PROPERTY_TEST_PARAMS: fc.Parameters<unknown> = {
  ...PROPERTY_TEST_PARAMS,
  numRuns: 500,
}

/**
 * Helper para crear una prueba de propiedad con configuración estándar
 *
 * @example
 * ```typescript
 * describe('Feature: inventory-quantity-management, Property 1: Consistencia de Agrupación de Equipos', () => {
 *   it('debe preservar todos los items al agrupar', () => {
 *     runPropertyTest(
 *       fc.array(equipmentArbitrary(), { minLength: 1, maxLength: 100 }),
 *       (equipment) => {
 *         const groups = groupByModel(equipment)
 *         const totalUnits = groups.reduce((sum, g) => sum + g.units.length, 0)
 *         expect(totalUnits).toBe(equipment.length)
 *       }
 *     )
 *   })
 * })
 * ```
 */
export function runPropertyTest<T>(
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => void | boolean,
  params: fc.Parameters<unknown> = PROPERTY_TEST_PARAMS
): void {
  fc.assert(fc.property(arbitrary, predicate), params)
}

/**
 * Helper para crear una prueba de propiedad con parámetros personalizados
 */
export function runPropertyTestWithParams<T>(
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => void | boolean,
  customParams: Partial<fc.Parameters<unknown>>
): void {
  fc.assert(fc.property(arbitrary, predicate), { ...PROPERTY_TEST_PARAMS, ...customParams })
}

/**
 * Formato de etiqueta para pruebas basadas en propiedades
 * Usar esto para etiquetar todas las pruebas de propiedades para fácil identificación
 *
 * @example
 * ```typescript
 * describe(propertyTestTag('inventory-quantity-management', 1, 'Consistencia de Agrupación de Equipos'), () => {
 *   // implementación de la prueba
 * })
 * ```
 */
export function propertyTestTag(
  feature: string,
  propertyNumber: number,
  propertyName: string
): string {
  return `Feature: ${feature}, Property ${propertyNumber}: ${propertyName}`
}

/**
 * Helper para validar cobertura de requisitos en pruebas de propiedades
 * Usar en descripciones de pruebas para documentar qué requisitos se validan
 *
 * @example
 * ```typescript
 * it(validatesRequirements('1.1', '1.8'), () => {
 *   // implementación de la prueba
 * })
 * ```
 */
export function validatesRequirements(...requirements: string[]): string {
  return `valida requisitos: ${requirements.join(', ')}`
}
