/**
 * Data Migration Service Tests
 */

// Mock dependencies before importing
jest.mock('@/lib/logging/logger')
jest.mock('@/lib/config/configuration-service')

import { DataMigrationService, MigrationSchemas } from '@/lib/migration/data-migration-service'

describe('DataMigrationService', () => {
  let service: DataMigrationService

  beforeEach(() => {
    service = new DataMigrationService()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createMigration', () => {
    it('should create a migration with valid steps', async () => {
      const steps = [
        {
          id: 'test_step',
          name: 'Test Step',
          description: 'Test step description',
          execute: jest.fn().mockResolvedValue({
            success: true,
            processedRecords: 10,
            errors: [],
            warnings: [],
          }),
        },
      ]

      const migrationId = await service.createMigration(steps)

      expect(migrationId).toMatch(/^migration_\d+_[a-z0-9]+$/)
      expect(service.getMigrationProgress(migrationId)).toBeTruthy()
    })

    it('should validate migration steps', async () => {
      const stepsWithDuplicateIds = [
        {
          id: 'duplicate',
          name: 'Step 1',
          description: 'First step',
          execute: jest.fn(),
        },
        {
          id: 'duplicate',
          name: 'Step 2',
          description: 'Second step',
          execute: jest.fn(),
        },
      ]

      await expect(service.createMigration(stepsWithDuplicateIds))
        .rejects.toThrow('Duplicate step ID: duplicate')
    })

    it('should validate step dependencies', async () => {
      const stepsWithInvalidDependency = [
        {
          id: 'step1',
          name: 'Step 1',
          description: 'First step',
          dependencies: ['nonexistent'],
          execute: jest.fn(),
        },
      ]

      await expect(service.createMigration(stepsWithInvalidDependency))
        .rejects.toThrow('Step step1 depends on non-existent step: nonexistent')
    })
  })

  describe('executeMigration', () => {
    it('should execute migration steps in correct order', async () => {
      const executeOrder: string[] = []
      
      const steps = [
        {
          id: 'step2',
          name: 'Step 2',
          description: 'Second step',
          dependencies: ['step1'],
          execute: jest.fn().mockImplementation(async () => {
            executeOrder.push('step2')
            return { success: true, processedRecords: 5, errors: [], warnings: [] }
          }),
        },
        {
          id: 'step1',
          name: 'Step 1',
          description: 'First step',
          execute: jest.fn().mockImplementation(async () => {
            executeOrder.push('step1')
            return { success: true, processedRecords: 10, errors: [], warnings: [] }
          }),
        },
      ]

      const migrationId = await service.createMigration(steps)
      const result = await service.executeMigration(migrationId, steps)

      expect(result.success).toBe(true)
      expect(executeOrder).toEqual(['step1', 'step2'])
      expect(result.processedRecords).toBe(15)
    })

    it('should handle step failures', async () => {
      const steps = [
        {
          id: 'failing_step',
          name: 'Failing Step',
          description: 'This step will fail',
          execute: jest.fn().mockResolvedValue({
            success: false,
            processedRecords: 0,
            errors: [{
              step: 'failing_step',
              error: 'Test error',
              severity: 'critical' as const,
              recoverable: false,
            }],
            warnings: [],
          }),
        },
      ]

      const migrationId = await service.createMigration(steps, { continueOnError: false })
      const result = await service.executeMigration(migrationId, steps)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0].error).toBe('Test error')
    })

    it('should continue on error when configured', async () => {
      const steps = [
        {
          id: 'failing_step',
          name: 'Failing Step',
          description: 'This step will fail',
          execute: jest.fn().mockResolvedValue({
            success: false,
            processedRecords: 0,
            errors: [{
              step: 'failing_step',
              error: 'Test error',
              severity: 'error' as const,
              recoverable: true,
            }],
            warnings: [],
          }),
        },
        {
          id: 'success_step',
          name: 'Success Step',
          description: 'This step will succeed',
          execute: jest.fn().mockResolvedValue({
            success: true,
            processedRecords: 5,
            errors: [],
            warnings: [],
          }),
        },
      ]

      const migrationId = await service.createMigration(steps, { continueOnError: true })
      const result = await service.executeMigration(migrationId, steps)

      expect(result.success).toBe(true)
      expect(result.errors).toHaveLength(1)
      expect(result.processedRecords).toBe(5)
    })
  })

  describe('importData', () => {
    it('should import valid user data', async () => {
      const userData = [
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

      const result = await service.importData(userData, 'users', { validate: true })

      expect(result.imported).toHaveLength(2)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('should validate data during import', async () => {
      const invalidUserData = [
        {
          id: '1',
          email: 'invalid-email',
          name: 'Test User',
          role: 'USER',
        },
      ]

      const result = await service.importData(invalidUserData, 'users', { validate: true })

      expect(result.imported).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('Validation failed')
    })

    it('should transform data during import', async () => {
      const userData = [
        {
          email: 'TEST@EXAMPLE.COM',
          name: 'Test User',
          role: 'user',
        },
      ]

      const result = await service.importData(userData, 'users', { 
        validate: false, 
        transform: true 
      })

      expect(result.imported).toHaveLength(1)
      expect(result.imported[0].email).toBe('test@example.com')
      expect(result.imported[0].role).toBe('USER')
    })

    it('should process data in batches', async () => {
      const largeDataset = Array.from({ length: 2500 }, (_, i) => ({
        id: `${i + 1}`,
        email: `user${i + 1}@example.com`,
        name: `User ${i + 1}`,
        role: 'USER',
      }))

      const result = await service.importData(largeDataset, 'users', { 
        validate: true,
        batchSize: 1000 
      })

      expect(result.imported).toHaveLength(2500)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('exportData', () => {
    const testData = [
      { id: '1', name: 'Test 1', value: 100 },
      { id: '2', name: 'Test 2', value: 200 },
    ]

    it('should export data to JSON format', async () => {
      const result = await service.exportData(testData, 'json')
      const parsed = JSON.parse(result)

      expect(parsed.data).toHaveLength(2)
      expect(parsed.data[0]).toEqual(testData[0])
    })

    it('should export data to CSV format', async () => {
      const result = await service.exportData(testData, 'csv')
      const lines = result.split('\n')

      expect(lines[0]).toBe('id,name,value')
      expect(lines[1]).toBe('1,Test 1,100')
      expect(lines[2]).toBe('2,Test 2,200')
    })

    it('should export data to XML format', async () => {
      const result = await service.exportData(testData, 'xml')

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(result).toContain('<data>')
      expect(result).toContain('<record>')
      expect(result).toContain('<id>1</id>')
      expect(result).toContain('<name>Test 1</name>')
    })

    it('should include metadata when requested', async () => {
      const result = await service.exportData(testData, 'json', { includeMetadata: true })
      const parsed = JSON.parse(result)

      expect(parsed.metadata).toBeDefined()
      expect(parsed.metadata.recordCount).toBe(2)
      expect(parsed.metadata.exportedAt).toBeDefined()
    })
  })

  describe('getMigrationProgress', () => {
    it('should return progress for active migration', async () => {
      const steps = [
        {
          id: 'test_step',
          name: 'Test Step',
          description: 'Test step',
          execute: jest.fn().mockResolvedValue({
            success: true,
            processedRecords: 10,
            errors: [],
            warnings: [],
          }),
        },
      ]

      const migrationId = await service.createMigration(steps)
      const progress = service.getMigrationProgress(migrationId)

      expect(progress).toBeTruthy()
      expect(progress?.totalSteps).toBe(1)
      expect(progress?.completedSteps).toBe(0)
    })

    it('should return null for non-existent migration', () => {
      const progress = service.getMigrationProgress('non-existent')
      expect(progress).toBeNull()
    })
  })

  describe('cleanupMigration', () => {
    it('should cleanup migration resources', async () => {
      const steps = [
        {
          id: 'test_step',
          name: 'Test Step',
          description: 'Test step',
          execute: jest.fn(),
        },
      ]

      const migrationId = await service.createMigration(steps)
      expect(service.getMigrationProgress(migrationId)).toBeTruthy()

      service.cleanupMigration(migrationId)
      expect(service.getMigrationProgress(migrationId)).toBeNull()
    })
  })

  describe('MigrationSchemas', () => {
    it('should validate user schema', () => {
      const validUser = {
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      }

      const result = MigrationSchemas.users.safeParse(validUser)
      expect(result.success).toBe(true)
    })

    it('should reject invalid user schema', () => {
      const invalidUser = {
        email: 'invalid-email',
        name: '',
        role: 'INVALID_ROLE',
      }

      const result = MigrationSchemas.users.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })

    it('should validate ticket schema', () => {
      const validTicket = {
        title: 'Test Ticket',
        description: 'Test description',
        status: 'OPEN',
        priority: 'MEDIUM',
        userId: 'user123',
      }

      const result = MigrationSchemas.tickets.safeParse(validTicket)
      expect(result.success).toBe(true)
    })

    it('should validate category schema', () => {
      const validCategory = {
        name: 'Test Category',
        description: 'Test description',
      }

      const result = MigrationSchemas.categories.safeParse(validCategory)
      expect(result.success).toBe(true)
    })
  })
})