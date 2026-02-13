import { ValidationService, CommonSchemas, createValidationMiddleware } from '@/lib/security/validation'

describe('ValidationService', () => {
  describe('sanitizeHtml', () => {
    it('should sanitize dangerous HTML tags', () => {
      const dangerous = '<script>alert("xss")</script><p>Safe content</p>'
      const result = ValidationService.sanitizeHtml(dangerous)
      expect(result).toBe('<p>Safe content</p>')
      expect(result).not.toContain('<script>')
    })

    it('should allow safe HTML tags', () => {
      const safe = '<p>Paragraph</p><strong>Bold</strong><em>Italic</em>'
      const result = ValidationService.sanitizeHtml(safe)
      expect(result).toBe('<p>Paragraph</p><strong>Bold</strong><em>Italic</em>')
    })

    it('should handle text mode', () => {
      const html = '<p>Text with <strong>formatting</strong></p>'
      const result = ValidationService.sanitizeHtml(html, 'text')
      expect(result).toBe('Text with formatting')
    })

    it('should handle empty input', () => {
      expect(ValidationService.sanitizeHtml('')).toBe('')
      expect(ValidationService.sanitizeHtml(null as any)).toBe('')
      expect(ValidationService.sanitizeHtml(undefined as any)).toBe('')
    })
  })

  describe('sanitizeText', () => {
    it('should remove dangerous characters', () => {
      const dangerous = 'Hello <script>alert("xss")</script> World'
      const result = ValidationService.sanitizeText(dangerous)
      expect(result).toBe('Hello scriptalert(xss)/script World')
    })

    it('should trim whitespace', () => {
      const text = '  Hello World  '
      const result = ValidationService.sanitizeText(text)
      expect(result).toBe('Hello World')
    })

    it('should limit length', () => {
      const longText = 'a'.repeat(1500)
      const result = ValidationService.sanitizeText(longText)
      expect(result.length).toBe(1000)
    })

    it('should handle empty input', () => {
      expect(ValidationService.sanitizeText('')).toBe('')
      expect(ValidationService.sanitizeText(null as any)).toBe('')
    })
  })

  describe('sanitizeEmail', () => {
    it('should validate and clean valid emails', () => {
      expect(ValidationService.sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com')
      expect(ValidationService.sanitizeEmail('  user@domain.org  ')).toBe('user@domain.org')
    })

    it('should reject invalid emails', () => {
      expect(ValidationService.sanitizeEmail('invalid-email')).toBe('')
      expect(ValidationService.sanitizeEmail('user@')).toBe('')
      expect(ValidationService.sanitizeEmail('@domain.com')).toBe('')
      expect(ValidationService.sanitizeEmail('')).toBe('')
    })
  })

  describe('sanitizeUrl', () => {
    it('should validate and clean valid URLs', () => {
      expect(ValidationService.sanitizeUrl('https://example.com')).toBe('https://example.com/')
      expect(ValidationService.sanitizeUrl('http://test.org/path')).toBe('http://test.org/path')
    })

    it('should reject dangerous protocols', () => {
      expect(ValidationService.sanitizeUrl('javascript:alert("xss")')).toBe('')
      expect(ValidationService.sanitizeUrl('data:text/html,<script>alert("xss")</script>')).toBe('')
      expect(ValidationService.sanitizeUrl('ftp://example.com')).toBe('')
    })

    it('should handle invalid URLs', () => {
      expect(ValidationService.sanitizeUrl('not-a-url')).toBe('')
      expect(ValidationService.sanitizeUrl('')).toBe('')
    })
  })

  describe('sanitizeFilename', () => {
    it('should sanitize dangerous filename characters', () => {
      expect(ValidationService.sanitizeFilename('file<>name.txt')).toBe('file__name.txt')
      expect(ValidationService.sanitizeFilename('file/path\\name.txt')).toBe('file_path_name.txt')
    })

    it('should prevent directory traversal', () => {
      expect(ValidationService.sanitizeFilename('../../../etc/passwd')).toBe('_._._etc_passwd')
      expect(ValidationService.sanitizeFilename('..\\windows\\system32')).toBe('_windows_system32')
    })

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.txt'
      const result = ValidationService.sanitizeFilename(longName)
      expect(result.length).toBe(255)
    })
  })

  describe('validateMimeType', () => {
    it('should validate exact mime types', () => {
      const allowed = ['image/jpeg', 'image/png', 'application/pdf']
      expect(ValidationService.validateMimeType('image/jpeg', allowed)).toBe(true)
      expect(ValidationService.validateMimeType('application/pdf', allowed)).toBe(true)
      expect(ValidationService.validateMimeType('text/plain', allowed)).toBe(false)
    })

    it('should validate wildcard mime types', () => {
      const allowed = ['image/*', 'text/*']
      expect(ValidationService.validateMimeType('image/jpeg', allowed)).toBe(true)
      expect(ValidationService.validateMimeType('text/plain', allowed)).toBe(true)
      expect(ValidationService.validateMimeType('application/pdf', allowed)).toBe(false)
    })

    it('should handle invalid input', () => {
      expect(ValidationService.validateMimeType('', ['image/*'])).toBe(false)
      expect(ValidationService.validateMimeType(null as any, ['image/*'])).toBe(false)
    })
  })

  describe('validateFileSize', () => {
    it('should validate file sizes within limits', () => {
      expect(ValidationService.validateFileSize(1000, 2000)).toBe(true)
      expect(ValidationService.validateFileSize(2000, 2000)).toBe(true)
    })

    it('should reject files that are too large', () => {
      expect(ValidationService.validateFileSize(3000, 2000)).toBe(false)
    })

    it('should reject invalid sizes', () => {
      expect(ValidationService.validateFileSize(0, 2000)).toBe(false)
      expect(ValidationService.validateFileSize(-1, 2000)).toBe(false)
      expect(ValidationService.validateFileSize(NaN, 2000)).toBe(false)
    })
  })

  describe('sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const input = {
        title: '<script>alert("xss")</script>Clean Title',
        user: {
          name: 'John <script>alert("xss")</script> Doe',
          email: '  TEST@EXAMPLE.COM  ',
        },
        tags: ['<script>tag1</script>', 'tag2'],
      }

      const result = ValidationService.sanitizeObject(input)
      expect(result.title).toBe('scriptalert(xss)/scriptClean Title')
      expect(result.user.name).toBe('John scriptalert(xss)/script Doe')
      expect(result.tags[0]).toBe('scripttag1/script')
    })

    it('should handle primitive values', () => {
      expect(ValidationService.sanitizeObject('test')).toBe('test')
      expect(ValidationService.sanitizeObject(123)).toBe(123)
      expect(ValidationService.sanitizeObject(true)).toBe(true)
      expect(ValidationService.sanitizeObject(null)).toBe(null)
    })
  })
})

describe('CommonSchemas', () => {
  describe('ticket schema', () => {
    it('should validate valid ticket data', () => {
      const validTicket = {
        title: 'Test Ticket',
        description: 'Test Description',
        priority: 'MEDIUM',
        categoryId: 'clp123456789012345678',
      }

      expect(() => CommonSchemas.ticket.parse(validTicket)).not.toThrow()
    })

    it('should reject invalid ticket data', () => {
      const invalidTicket = {
        title: '', // Empty title
        description: 'Test Description',
        priority: 'INVALID', // Invalid priority
        categoryId: 'invalid-id', // Invalid CUID
      }

      expect(() => CommonSchemas.ticket.parse(invalidTicket)).toThrow()
    })
  })

  describe('pagination schema', () => {
    it('should provide default values', () => {
      const result = CommonSchemas.pagination.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
      expect(result.sortOrder).toBe('desc')
    })

    it('should validate custom values', () => {
      const input = { page: 2, limit: 25, sortBy: 'createdAt', sortOrder: 'asc' as const }
      const result = CommonSchemas.pagination.parse(input)
      expect(result).toEqual(input)
    })
  })
})

describe('createValidationMiddleware', () => {
  it('should sanitize and validate data', () => {
    const schema = CommonSchemas.user
    const middleware = createValidationMiddleware(schema)

    const input = {
      name: '<script>alert("xss")</script>John Doe',
      email: '  TEST@EXAMPLE.COM  ',
      department: 'IT',
    }

    const result = middleware(input)
    expect(result.name).toBe('scriptalert(xss)/scriptJohn Doe')
    expect(result.email).toBe('TEST@EXAMPLE.COM') // El middleware no sanitiza emails automáticamente
  })

  it('should throw validation errors', () => {
    const schema = CommonSchemas.user
    const middleware = createValidationMiddleware(schema)

    const invalidInput = {
      name: '', // Empty name
      email: 'invalid-email', // Invalid email
    }

    expect(() => middleware(invalidInput)).toThrow()
  })
})