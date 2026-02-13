import { cn, formatDate, getInitials, truncateText } from '@/lib/utils'

describe('Utils', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      expect(cn('px-2 py-1', 'bg-red-500')).toBe('px-2 py-1 bg-red-500')
    })

    it('should handle conditional classes', () => {
      expect(cn('base-class', true && 'conditional-class')).toBe('base-class conditional-class')
      expect(cn('base-class', false && 'conditional-class')).toBe('base-class')
    })

    it('should merge conflicting Tailwind classes', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4')
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
    })
  })

  describe('formatDate', () => {
    it('should format Date object correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const formatted = formatDate(date)
      expect(formatted).toMatch(/15 de enero de 2024/)
    })

    it('should format date string correctly', () => {
      const dateString = '2024-12-25T15:45:00Z'
      const formatted = formatDate(dateString)
      expect(formatted).toMatch(/25 de diciembre de 2024/)
    })

    it('should handle invalid date gracefully', () => {
      expect(() => formatDate('invalid-date')).toThrow()
    })
  })

  describe('getInitials', () => {
    it('should get initials from full name', () => {
      expect(getInitials('Juan Pérez')).toBe('JP')
      expect(getInitials('María García López')).toBe('MG')
    })

    it('should handle single name', () => {
      expect(getInitials('Juan')).toBe('J')
    })

    it('should handle empty string', () => {
      expect(getInitials('')).toBe('')
    })

    it('should limit to 2 characters', () => {
      expect(getInitials('Ana María José García')).toBe('AM')
    })

    it('should convert to uppercase', () => {
      expect(getInitials('juan pérez')).toBe('JP')
    })
  })

  describe('truncateText', () => {
    it('should truncate text when longer than maxLength', () => {
      const text = 'Este es un texto muy largo que necesita ser truncado'
      expect(truncateText(text, 20)).toBe('Este es un texto muy...')
    })

    it('should return original text when shorter than maxLength', () => {
      const text = 'Texto corto'
      expect(truncateText(text, 20)).toBe('Texto corto')
    })

    it('should return original text when equal to maxLength', () => {
      const text = 'Exactamente veinte c'
      expect(truncateText(text, 20)).toBe('Exactamente veinte c')
    })

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('')
    })

    it('should handle zero maxLength', () => {
      expect(truncateText('test', 0)).toBe('...')
    })
  })
})