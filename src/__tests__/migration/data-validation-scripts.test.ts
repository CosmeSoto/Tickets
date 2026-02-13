/**
 * Data Validation Scripts Tests
 */

// Mock dependencies before importing
jest.mock('@/lib/logging/logger')

import { DataValidationScripts } from '@/lib/migration/data-validation-scripts'

describe('DataValidationScripts', () => {
  let service: DataValidationScripts

  beforeEach(() => {
    service = new DataValidationScripts()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('validateUsers', () => {
    it('should validate correct user data', async () => {
      const users = [
        {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
        },
        {
          id: '2',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'ADMIN',
        },
      ]

      const result = await service.validateUsers(users)

      expect(result.passed).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.statistics.totalRecords).toBe(2)
    })

    it('should detect invalid email formats', async () => {
      const users = [
        {
          id: '1',
          email: 'invalid-email',
          name: 'Test User',
          role: 'USER',
        },
      ]

      const result = await service.validateUsers(users)

      expect(result.passed).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('email')
      expect(result.errors[0].message).toContain('Invalid email format')
    })

    it('should detect duplicate email addresses', async () => {
      const users = [
        {
          id: '1',
          email: 'test@example.com',
          name: 'User 1',
          role: 'USER',
        },
        {
          id: '2',
          email: 'test@example.com',
          name: 'User 2',
          role: 'USER',
        },
      ]

      const result = await service.validateUsers(users)

      expect(result.passed).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.message.includes('Duplicate email'))).toBe(true)
    })

    it('should detect missing required fields', async () => {
      const users = [
        {
          id: '1',
          email: '',
          name: 'Test User',
          role: 'USER',
        },
        {
          id: '2',
          email: 'test@example.com',
          name: '',
          role: 'USER',
        },
      ]

      const result = await service.validateUsers(users)

      expect(result.passed).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
      expect(result.errors.some(e => e.field === 'email')).toBe(true)
      expect(result.errors.some(e => e.field === 'name')).toBe(true)
    })

    it('should detect invalid user roles', async () => {
      const users = [
        {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'INVALID_ROLE',
        },
      ]

      const result = await service.validateUsers(users)

      expect(result.passed).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('role')
      expect(result.errors[0].message).toContain('Invalid role')
    })

    it('should warn about name length issues', async () => {
      const users = [
        {
          id: '1',
          email: 'test1@example.com',
          name: 'A',
          role: 'USER',
        },
        {
          id: '2',
          email: 'test2@example.com',
          name: 'A'.repeat(150),
          role: 'USER',
        },
      ]

      const result = await service.validateUsers(users)

      expect(result.warnings.length).toBeGreaterThanOrEqual(2)
      expect(result.warnings.some(w => w.message.includes('very short'))).toBe(true)
      expect(result.warnings.some(w => w.message.includes('very long'))).toBe(true)
    })
  })

  describe('validateTickets', () => {
    it('should validate correct ticket data', async () => {
      const tickets = [
        {
          id: '1',
          title: 'Test Ticket',
          description: 'Test description',
          status: 'OPEN',
          priority: 'MEDIUM',
          userId: 'user1',
        },
      ]

      const result = await service.validateTickets(tickets)

      expect(result.passed).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', async () => {
      const tickets = [
        {
          id: '1',
          title: '',
          description: 'Test description',
          userId: 'user1',
        },
        {
          id: '2',
          title: 'Test Ticket',
          description: '',
          userId: '',
        },
      ]

      const result = await service.validateTickets(tickets)

      expect(result.passed).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(3)
    })

    it('should detect invalid status values', async () => {
      const tickets = [
        {
          id: '1',
          title: 'Test Ticket',
          description: 'Test description',
          status: 'INVALID_STATUS',
          userId: 'user1',
        },
      ]

      const result = await service.validateTickets(tickets)

      expect(result.passed).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('status')
    })

    it('should detect invalid priority values', async () => {
      const tickets = [
        {
          id: '1',
          title: 'Test Ticket',
          description: 'Test description',
          priority: 'INVALID_PRIORITY',
          userId: 'user1',
        },
      ]

      const result = await service.validateTickets(tickets)

      expect(result.passed).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('priority')
    })

    it('should warn about title length issues', async () => {
      const tickets = [
        {
          id: '1',
          title: 'Hi',
          description: 'Test description',
          userId: 'user1',
        },
        {
          id: '2',
          title: 'A'.repeat(250),
          description: 'Test description',
          userId: 'user1',
        },
      ]

      const result = await service.validateTickets(tickets)

      expect(result.warnings.length).toBeGreaterThanOrEqual(2)
    })

    it('should warn about empty descriptions', async () => {
      const tickets = [
        {
          id: '1',
          title: 'Test Ticket',
          description: '',
          userId: 'user1',
        },
      ]

      const result = await service.validateTickets(tickets)

      expect(result.warnings.length).toBeGreaterThanOrEqual(1)
      expect(result.warnings.some(w => w.message.includes('description'))).toBe(true)
    })
  })

  describe('validateCategories', () => {
    it('should validate correct category data', async () => {
      const categories = [
        {
          id: '1',
          name: 'Hardware',
          description: 'Hardware issues',
        },
        {
          id: '2',
          name: 'Software',
          description: 'Software issues',
        },
      ]

      const result = await service.validateCategories(categories)

      expect(result.passed).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', async () => {
      const categories = [
        {
          id: '1',
          name: '',
          description: 'Test description',
        },
      ]

      const result = await service.validateCategories(categories)

      expect(result.passed).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('name')
    })

    it('should detect duplicate category names', async () => {
      const categories = [
        {
          id: '1',
          name: 'Hardware',
          description: 'Hardware issues',
        },
        {
          id: '2',
          name: 'Hardware',
          description: 'Different hardware issues',
        },
      ]

      const result = await service.validateCategories(categories)

      expect(result.passed).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.message.includes('Duplicate category name'))).toBe(true)
    })

    it('should detect invalid parent references', async () => {
      const categories = [
        {
          id: '1',
          name: 'Hardware',
          parentId: 'nonexistent',
        },
      ]

      const result = await service.validateCategories(categories)

      expect(result.passed).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('parentId')
    })

    it('should detect circular references', async () => {
      const categories = [
        {
          id: '1',
          name: 'Category 1',
          parentId: '2',
        },
        {
          id: '2',
          name: 'Category 2',
          parentId: '1',
        },
      ]

      const result = await service.validateCategories(categories)

      expect(result.passed).toBe(false)
      expect(result.errors.some(e => e.message.includes('Circular reference'))).toBe(true)
    })
  })

  describe('performDataIntegrityChecks', () => {
    it('should pass integrity checks for valid data', async () => {
      const data = {
        users: [
          { id: '1', email: 'user1@example.com', name: 'User 1', role: 'USER' },
        ],
        tickets: [
          { id: '1', title: 'Ticket 1', userId: '1', status: 'OPEN', priority: 'MEDIUM' },
        ],
        categories: [
          { id: '1', name: 'Category 1' },
        ],
      }

      const result = await service.performDataIntegrityChecks(data)

      expect(result.passed).toBe(true)
      expect(result.summary.criticalFailures).toBe(0)
    })

    it('should detect referential integrity issues', async () => {
      const data = {
        users: [
          { id: '1', email: 'user1@example.com', name: 'User 1', role: 'USER' },
        ],
        tickets: [
          { id: '1', title: 'Ticket 1', userId: 'nonexistent', status: 'OPEN' },
        ],
        categories: [],
      }

      const result = await service.performDataIntegrityChecks(data)

      expect(result.passed).toBe(false)
      expect(result.summary.failedChecks).toBeGreaterThan(0)
    })
  })

  describe('generateDataQualityReport', () => {
    it('should generate comprehensive quality report', async () => {
      const data = {
        users: [
          { id: '1', email: 'user1@example.com', name: 'User 1', role: 'USER' },
          { id: '2', email: 'user2@example.com', name: 'User 2', role: 'ADMIN' },
        ],
        tickets: [
          { id: '1', title: 'Ticket 1', description: 'Description 1', userId: '1', status: 'OPEN', priority: 'HIGH' },
          { id: '2', title: 'Ticket 2', description: 'Description 2', userId: '2', status: 'CLOSED', priority: 'LOW' },
        ],
        categories: [
          { id: '1', name: 'Hardware' },
          { id: '2', name: 'Software' },
        ],
      }

      const report = await service.generateDataQualityReport(data)

      expect(report.overall).toBeDefined()
      expect(report.score).toBeGreaterThanOrEqual(0)
      expect(report.score).toBeLessThanOrEqual(100)
      expect(report.details.users).toBeDefined()
      expect(report.details.tickets).toBeDefined()
      expect(report.details.categories).toBeDefined()
      expect(report.details.integrity).toBeDefined()
      expect(Array.isArray(report.recommendations)).toBe(true)
    })

    it('should rate excellent quality for perfect data', async () => {
      const data = {
        users: [
          { id: '1', email: 'user1@example.com', name: 'User 1', role: 'USER' },
        ],
        tickets: [
          { id: '1', title: 'Perfect Ticket', description: 'Perfect description', userId: '1', status: 'OPEN', priority: 'MEDIUM' },
        ],
        categories: [
          { id: '1', name: 'Perfect Category' },
        ],
      }

      const report = await service.generateDataQualityReport(data)

      expect(report.score).toBeGreaterThan(80)
      expect(['excellent', 'good']).toContain(report.overall)
    })

    it('should rate poor quality for problematic data', async () => {
      const data = {
        users: [
          { id: '1', email: 'invalid-email', name: '', role: 'INVALID' },
        ],
        tickets: [
          { id: '1', title: '', description: '', userId: 'nonexistent', status: 'INVALID', priority: 'INVALID' },
        ],
        categories: [
          { id: '1', name: '' },
        ],
      }

      const report = await service.generateDataQualityReport(data)

      expect(report.score).toBeLessThan(60)
      expect(['poor', 'fair']).toContain(report.overall)
    })
  })
})