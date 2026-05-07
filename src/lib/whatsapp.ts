/**
 * Builds a WhatsApp contact URL with a pre-formatted message for equipment sales.
 *
 * @param phone - Phone number (will be cleaned of non-numeric characters)
 * @param item - Equipment details to include in the message
 * @returns WhatsApp URL with encoded message
 *
 * @example
 * ```ts
 * const url = buildWhatsAppContactUrl('593987654321', {
 *   brand: 'Dell',
 *   model: 'Latitude 5420',
 *   type: 'Laptop',
 *   family: 'Tecnología',
 *   condition: 'GOOD',
 *   code: 'TECH-LAP-OWN-2024-0001',
 *   saleListingPrice: 850.50
 * });
 * // Returns: https://wa.me/593987654321?text=...
 * ```
 */
export function buildWhatsAppContactUrl(
  phone: string,
  item: {
    brand: string
    model: string
    type: string
    family: string
    condition: string
    code: string
    saleListingPrice: number | null
  }
): string {
  const conditionLabel: Record<string, string> = {
    NEW: 'Nuevo',
    LIKE_NEW: 'Como Nuevo',
    GOOD: 'Bueno',
    FAIR: 'Regular',
    POOR: 'Malo',
  }

  const price = item.saleListingPrice
    ? new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(
        item.saleListingPrice
      )
    : 'Consultar precio'

  const message = [
    `Hola, estoy interesado en el siguiente equipo en venta:`,
    ``,
    `📦 *${item.brand} ${item.model}*`,
    `🏷️ Tipo: ${item.type} | Familia: ${item.family}`,
    `⭐ Condición: ${conditionLabel[item.condition] ?? item.condition}`,
    `💰 Precio: ${price}`,
    ``,
    `Código: ${item.code}`,
    ``,
    `¿Podría darme más información?`,
  ].join('\n')

  const cleanPhone = phone.replace(/\D/g, '')
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}
