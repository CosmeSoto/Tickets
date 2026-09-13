import {
  isBusinessDay,
  isWithinBusinessHours,
  suggestBusinessDateTime,
  formatBusinessHoursLabel,
  DEFAULT_BUSINESS_HOURS,
} from '@/lib/utils/business-hours'

describe('business-hours', () => {
  describe('isBusinessDay', () => {
    it('treats Mon-Fri as business days by default', () => {
      // 2026-09-14 es lunes, 2026-09-18 es viernes
      expect(isBusinessDay(new Date(2026, 8, 14))).toBe(true)
      expect(isBusinessDay(new Date(2026, 8, 18))).toBe(true)
    })

    it('treats Sat/Sun as non-business days by default', () => {
      // 2026-09-12 es sábado, 2026-09-13 es domingo
      expect(isBusinessDay(new Date(2026, 8, 12))).toBe(false)
      expect(isBusinessDay(new Date(2026, 8, 13))).toBe(false)
    })
  })

  describe('isWithinBusinessHours', () => {
    it('is true right at the start boundary (09:00)', () => {
      expect(isWithinBusinessHours(new Date(2026, 8, 14, 9, 0))).toBe(true)
    })

    it('is false right at the end boundary (18:00, exclusivo)', () => {
      expect(isWithinBusinessHours(new Date(2026, 8, 14, 18, 0))).toBe(false)
    })

    it('is false one minute before opening', () => {
      expect(isWithinBusinessHours(new Date(2026, 8, 14, 8, 59))).toBe(false)
    })

    it('is false on a weekend even within the hour range', () => {
      expect(isWithinBusinessHours(new Date(2026, 8, 12, 10, 0))).toBe(false)
    })
  })

  describe('suggestBusinessDateTime', () => {
    it('keeps the time as-is when already within business hours', () => {
      const from = new Date(2026, 8, 14, 11, 30) // lunes 11:30
      const result = suggestBusinessDateTime(from)
      expect(result).toEqual(from)
    })

    it('rolls forward to the start of the same day when too early', () => {
      const from = new Date(2026, 8, 14, 6, 0) // lunes 06:00
      const result = suggestBusinessDateTime(from)
      expect(result.getDate()).toBe(14)
      expect(result.getHours()).toBe(9)
      expect(result.getMinutes()).toBe(0)
    })

    it('rolls forward to the next business day when after hours', () => {
      const from = new Date(2026, 8, 14, 19, 0) // lunes 19:00
      const result = suggestBusinessDateTime(from)
      expect(result.getDate()).toBe(15) // martes
      expect(result.getHours()).toBe(9)
    })

    it('skips the weekend to land on Monday', () => {
      const from = new Date(2026, 8, 12, 10, 0) // sábado 10:00
      const result = suggestBusinessDateTime(from)
      expect(result.getDay()).toBe(1) // lunes
      expect(result.getDate()).toBe(14)
      expect(result.getHours()).toBe(9)
    })
  })

  describe('formatBusinessHoursLabel', () => {
    it('shows the compact L-V label for the default weekday config', () => {
      expect(formatBusinessHoursLabel()).toBe('09:00–18:00, L-V')
    })

    it('lists individual days for a custom config', () => {
      const custom = { ...DEFAULT_BUSINESS_HOURS, days: ['MON', 'WED', 'FRI'] }
      expect(formatBusinessHoursLabel(custom)).toBe('09:00–18:00, L, X, V')
    })
  })
})
