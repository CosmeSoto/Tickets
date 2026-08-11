/**
 * Utilidades para generación de mensajes de WhatsApp
 * Genera mensajes formateados para contacto sobre equipos en venta
 */

import type { EquipmentGroup, PublicEquipmentItem } from '@/types/equipment-grouping'

/**
 * Genera mensaje de WhatsApp para contacto sobre un grupo de equipos
 *
 * El mensaje incluye:
 * - Marca y modelo del equipo
 * - Tipo de equipo
 * - Condición
 * - Precio (si está disponible)
 * - Cantidad de unidades disponibles
 *
 * NO incluye códigos específicos de equipos individuales
 *
 * @param group - Grupo de equipos sobre el cual consultar
 * @returns Mensaje formateado para WhatsApp
 *
 * @example
 * ```typescript
 * const message = generateGroupContactMessage(group)
 * // "Hola, estoy interesado en los Dell Latitude 5420 (Laptop) que tienen en venta.
 * //  Condición: Excelente. Precio: $800.00. Tienen 5 unidades disponibles.
 * //  ¿Podrían darme más información?"
 * ```
 */
export function generateGroupContactMessage(group: EquipmentGroup): string {
  const { brand, model, type, condition, saleListingPrice, availableUnits } = group

  // Construir mensaje base
  let message = `Hola, estoy interesado en los *${brand} ${model}* (${type.name}) que tienen en venta.`

  // Agregar condición
  const conditionText = getConditionText(condition)
  message += `\n\nCondición: ${conditionText}`

  // Agregar precio si está disponible
  if (saleListingPrice !== null) {
    const priceFormatted = new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(saleListingPrice)
    message += `\nPrecio: ${priceFormatted}`
  }

  // Agregar cantidad de unidades disponibles
  if (availableUnits > 1) {
    message += `\n\nTienen *${availableUnits} unidades disponibles*.`
  }

  // Agregar pregunta final
  message += '\n\n¿Podrían darme más información?'

  return message
}

/**
 * Genera mensaje de WhatsApp para contacto sobre una unidad específica de equipo
 *
 * El mensaje incluye:
 * - Marca y modelo del equipo
 * - Tipo de equipo
 * - Código específico de la unidad
 * - Número de serie (si está disponible)
 * - Condición
 * - Precio (si está disponible)
 *
 * @param unit - Unidad específica de equipo sobre la cual consultar
 * @returns Mensaje formateado para WhatsApp
 *
 * @example
 * ```typescript
 * const message = generateUnitContactMessage(unit)
 * // "Hola, estoy interesado en el equipo Dell Latitude 5420 (Laptop) con código TECH-LAP-OWN-2024-0001.
 * //  Número de serie: ABC123XYZ. Condición: Excelente. Precio: $800.00.
 * //  ¿Está disponible?"
 * ```
 */
export function generateUnitContactMessage(unit: PublicEquipmentItem): string {
  const { brand, model, type, code, serialNumber, condition, saleListingPrice } = unit

  // Construir mensaje base con código específico
  let message = `Hola, estoy interesado en el equipo *${brand} ${model}* (${type.name}) con código *${code}*.`

  // Agregar número de serie si está disponible
  if (serialNumber && serialNumber.trim().length > 0) {
    message += `\n\nNúmero de serie: ${serialNumber}`
  }

  // Agregar condición
  const conditionText = getConditionText(condition)
  message += `\nCondición: ${conditionText}`

  // Agregar precio si está disponible
  if (saleListingPrice !== null) {
    const priceFormatted = new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(saleListingPrice)
    message += `\nPrecio: ${priceFormatted}`
  }

  // Agregar pregunta final
  message += '\n\n¿Está disponible?'

  return message
}

/**
 * Convierte el enum de condición a texto legible en español
 *
 * @param condition - Condición del equipo
 * @returns Texto legible de la condición
 */
function getConditionText(condition: string): string {
  const conditionMap: Record<string, string> = {
    NEW: 'Nuevo',
    USED: 'Usado',
    DAMAGED: 'Dañado',
    EXCELLENT: 'Excelente',
    GOOD: 'Bueno',
    FAIR: 'Regular',
    POOR: 'Malo',
    LIKE_NEW: 'Como nuevo',
    FOR_PARTS: 'Para repuestos',
  }

  return conditionMap[condition] || condition
}

/**
 * Genera URL de WhatsApp con mensaje pre-llenado
 *
 * @param message - Mensaje a enviar
 * @param phoneNumber - Número de teléfono opcional (formato: +52XXXXXXXXXX)
 * @returns URL de WhatsApp Web o App
 *
 * @example
 * ```typescript
 * const url = generateWhatsAppUrl(message, '+525512345678')
 * // "https://wa.me/525512345678?text=Hola%2C%20estoy%20interesado..."
 * ```
 */
export function generateWhatsAppUrl(message: string, phoneNumber?: string | null): string {
  const encodedMessage = encodeURIComponent(message)

  if (phoneNumber) {
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    if (cleanPhone.length >= 8) {
      return `https://wa.me/${cleanPhone}?text=${encodedMessage}`
    }
  }

  // Sin número válido no abrir chat “huérfano”: el caller debe deshabilitar el CTA
  return `https://wa.me/?text=${encodedMessage}`
}

/**
 * Genera mensaje de WhatsApp para múltiples equipos (carrito de compras)
 *
 * @param items - Array de items seleccionados
 * @returns Mensaje formateado con lista de equipos
 *
 * @example
 * ```typescript
 * const message = generateMultipleItemsMessage([unit1, unit2, unit3])
 * // "Hola, estoy interesado en los siguientes equipos:
 * //
 * //  1. Dell Latitude 5420 - Código: TECH-LAP-OWN-2024-0001 - $800.00
 * //  2. HP EliteBook 840 - Código: TECH-LAP-OWN-2024-0002 - $750.00
 * //  3. Lenovo ThinkPad X1 - Código: TECH-LAP-OWN-2024-0003 - $900.00
 * //
 * //  ¿Están disponibles?"
 * ```
 */
export function generateMultipleItemsMessage(items: PublicEquipmentItem[]): string {
  if (items.length === 0) {
    return 'Hola, estoy interesado en consultar sobre equipos disponibles.'
  }

  if (items.length === 1) {
    return generateUnitContactMessage(items[0])
  }

  let message = 'Hola, estoy interesado en los siguientes equipos:\n'

  items.forEach((item, index) => {
    const { brand, model, code, saleListingPrice } = item
    const number = index + 1

    message += `\n${number}. *${brand} ${model}*`
    message += `\n   Código: ${code}`

    if (saleListingPrice !== null) {
      const priceFormatted = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(saleListingPrice)
      message += ` - ${priceFormatted}`
    }
  })

  message += '\n\n¿Están disponibles?'

  return message
}

/**
 * Valida que un mensaje no contenga códigos de equipo cuando no debería
 * Útil para pruebas de propiedades
 *
 * @param message - Mensaje a validar
 * @returns true si el mensaje NO contiene códigos de equipo
 */
export function messageDoesNotContainEquipmentCode(message: string): boolean {
  // Patrón de código de equipo: {FAMILIA}-{TIPO}-{MODO}-{AÑO}-{SECUENCIA}
  const codePattern = /[A-Z]{2,10}-[A-Z]{2,10}-[A-Z]{3}-\d{4}-\d{4,5}/
  return !codePattern.test(message)
}

/**
 * Valida que un mensaje contenga un código de equipo específico
 * Útil para pruebas de propiedades
 *
 * @param message - Mensaje a validar
 * @param code - Código que debe estar presente
 * @returns true si el mensaje contiene el código
 */
export function messageContainsEquipmentCode(message: string, code: string): boolean {
  return message.includes(code)
}
