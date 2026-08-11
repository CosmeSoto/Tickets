/**
 * @jest-environment node
 */
import {
  normalizeWhatsAppPhone,
  resolveSalesWhatsAppPhone,
  buildWhatsAppChatUrl,
} from '@/lib/sales-whatsapp-contact'

describe('sales-whatsapp-contact', () => {
  it('normalizes plain phone and strips junk', () => {
    expect(normalizeWhatsAppPhone('+593 98-765-4321')).toBe('593987654321')
  })

  it('extracts phone from wa.me URL', () => {
    expect(normalizeWhatsAppPhone('https://wa.me/593987654321')).toBe('593987654321')
    expect(normalizeWhatsAppPhone('https://api.whatsapp.com/send?phone=593987654321&text=hola')).toBe(
      '593987654321'
    )
  })

  it('rejects too-short or empty', () => {
    expect(normalizeWhatsAppPhone('123')).toBeNull()
    expect(normalizeWhatsAppPhone('')).toBeNull()
    expect(normalizeWhatsAppPhone(null)).toBeNull()
  })

  it('prefers family over landing/settings', () => {
    expect(
      resolveSalesWhatsAppPhone({
        familyWhatsapp: '593111111111',
        landingSocialWhatsapp: 'https://wa.me/593222222222',
        settingsContactPhone: '593333333333',
      })
    ).toBe('593111111111')
  })

  it('falls back through landing then settings', () => {
    expect(
      resolveSalesWhatsAppPhone({
        landingSocialWhatsapp: 'https://wa.me/593222222222',
        settingsContactPhone: '593333333333',
      })
    ).toBe('593222222222')
    expect(
      resolveSalesWhatsAppPhone({
        settingsContactPhone: '593333333333',
      })
    ).toBe('593333333333')
  })

  it('builds chat url with optional text', () => {
    expect(buildWhatsAppChatUrl('593987654321')).toBe('https://wa.me/593987654321')
    expect(buildWhatsAppChatUrl('593987654321', 'Hola')).toContain('text=Hola')
  })
})
