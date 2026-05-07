import { buildWhatsAppContactUrl } from './whatsapp'

describe('buildWhatsAppContactUrl', () => {
  const mockItem = {
    brand: 'Dell',
    model: 'Latitude 5420',
    type: 'Laptop',
    family: 'Tecnología',
    condition: 'GOOD',
    code: 'TECH-LAP-OWN-2024-0001',
    saleListingPrice: 850.5,
  }

  it('should generate a valid WhatsApp URL with all equipment details', () => {
    const phone = '593987654321'
    const url = buildWhatsAppContactUrl(phone, mockItem)

    expect(url).toContain('https://wa.me/593987654321')
    expect(url).toContain('text=')

    const decodedMessage = decodeURIComponent(url.split('text=')[1])
    expect(decodedMessage).toContain('Dell Latitude 5420')
    expect(decodedMessage).toContain('Tipo: Laptop')
    expect(decodedMessage).toContain('Familia: Tecnología')
    expect(decodedMessage).toContain('Condición: Bueno')
    expect(decodedMessage).toContain('$850,50') // Ecuadorian locale uses comma
    expect(decodedMessage).toContain('Código: TECH-LAP-OWN-2024-0001')
  })

  it('should clean phone number by removing non-numeric characters', () => {
    const phone = '+593 98-765-4321'
    const url = buildWhatsAppContactUrl(phone, mockItem)

    // Check that the phone number in the URL is cleaned (no special chars in the wa.me part)
    expect(url).toContain('https://wa.me/593987654321')

    // Extract just the phone number part from the URL
    const phoneInUrl = url.match(/wa\.me\/(\d+)/)?.[1]
    expect(phoneInUrl).toBe('593987654321')
    expect(phoneInUrl).not.toContain('+')
    expect(phoneInUrl).not.toContain(' ')
    expect(phoneInUrl).not.toContain('-')
  })

  it('should display "Consultar precio" when saleListingPrice is null', () => {
    const itemWithoutPrice = { ...mockItem, saleListingPrice: null }
    const phone = '593987654321'
    const url = buildWhatsAppContactUrl(phone, itemWithoutPrice)

    const decodedMessage = decodeURIComponent(url.split('text=')[1])
    expect(decodedMessage).toContain('Consultar precio')
    expect(decodedMessage).not.toContain('$')
  })

  it('should map condition codes to Spanish labels correctly', () => {
    const conditions = [
      { code: 'NEW', label: 'Nuevo' },
      { code: 'LIKE_NEW', label: 'Como Nuevo' },
      { code: 'GOOD', label: 'Bueno' },
      { code: 'FAIR', label: 'Regular' },
      { code: 'POOR', label: 'Malo' },
    ]

    conditions.forEach(({ code, label }) => {
      const item = { ...mockItem, condition: code }
      const url = buildWhatsAppContactUrl('593987654321', item)
      const decodedMessage = decodeURIComponent(url.split('text=')[1])

      expect(decodedMessage).toContain(`Condición: ${label}`)
    })
  })

  it('should handle unknown condition codes gracefully', () => {
    const itemWithUnknownCondition = { ...mockItem, condition: 'UNKNOWN' }
    const phone = '593987654321'
    const url = buildWhatsAppContactUrl(phone, itemWithUnknownCondition)

    const decodedMessage = decodeURIComponent(url.split('text=')[1])
    expect(decodedMessage).toContain('Condición: UNKNOWN')
  })

  it('should format price in USD with Ecuadorian locale', () => {
    const itemWithPrice = { ...mockItem, saleListingPrice: 1234.56 }
    const phone = '593987654321'
    const url = buildWhatsAppContactUrl(phone, itemWithPrice)

    const decodedMessage = decodeURIComponent(url.split('text=')[1])
    // Ecuadorian locale uses comma for thousands and period for decimals
    expect(decodedMessage).toContain('$1.234,56')
  })

  it('should include all required message components', () => {
    const phone = '593987654321'
    const url = buildWhatsAppContactUrl(phone, mockItem)

    const decodedMessage = decodeURIComponent(url.split('text=')[1])

    // Check for greeting
    expect(decodedMessage).toContain('Hola, estoy interesado en el siguiente equipo en venta:')

    // Check for equipment details with emojis
    expect(decodedMessage).toContain('📦')
    expect(decodedMessage).toContain('🏷️')
    expect(decodedMessage).toContain('⭐')
    expect(decodedMessage).toContain('💰')

    // Check for closing question
    expect(decodedMessage).toContain('¿Podría darme más información?')
  })

  it('should properly encode special characters in the message', () => {
    const itemWithSpecialChars = {
      ...mockItem,
      brand: 'HP & Co.',
      model: 'ProBook 450 G8 (15")',
    }
    const phone = '593987654321'
    const url = buildWhatsAppContactUrl(phone, itemWithSpecialChars)

    // URL should be properly encoded
    expect(url).toContain('https://wa.me/')
    expect(url).toContain('text=')

    // When decoded, special characters should be preserved
    const decodedMessage = decodeURIComponent(url.split('text=')[1])
    expect(decodedMessage).toContain('HP & Co.')
    expect(decodedMessage).toContain('ProBook 450 G8 (15")')
  })
})
