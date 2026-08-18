import {
  parseTicketCode,
  formatTicketCode,
  exampleTicketCode,
} from '@/lib/tickets/ticket-code-format'

describe('ticket-code format', () => {
  it('parsea el formato actual PREF-YYYYMMDD-SEQ', () => {
    expect(parseTicketCode('ADM-20260818-0001')).toEqual({
      prefix: 'ADM',
      year: 2026,
      dateStamp: '20260818',
      sequence: 1,
      legacy: false,
    })
  })

  it('parsea el formato legado PREF-YYYY-SEQ', () => {
    expect(parseTicketCode('#adm-2026-0042')).toBeNull()
    expect(parseTicketCode('ADM-2026-0042')).toEqual({
      prefix: 'ADM',
      year: 2026,
      dateStamp: null,
      sequence: 42,
      legacy: true,
    })
  })

  it('rechaza códigos incompletos', () => {
    expect(parseTicketCode('ADM-2026')).toBeNull()
    expect(parseTicketCode('ADM-2026081-0001')).toBeNull()
    expect(parseTicketCode('')).toBeNull()
  })

  it('formatea con secuencia de 4 dígitos', () => {
    expect(formatTicketCode('ADM', '20260818', 1)).toBe('ADM-20260818-0001')
    expect(formatTicketCode('TI', '20260105', 128)).toBe('TI-20260105-0128')
  })

  it('exampleTicketCode usa YYYYMMDD y secuencia 0001', () => {
    const example = exampleTicketCode('ADM', new Date('2026-08-18T15:00:00Z'))
    expect(example).toMatch(/^ADM-\d{8}-0001$/)
  })
})
