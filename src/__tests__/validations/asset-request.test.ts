import { AssetRequestStatus, AssetType } from '@prisma/client'
import {
  createAssetRequestSchema,
  updateStatusSchema,
  addCommentSchema,
  updateFamilyConfigSchema,
  validateReviewerComment,
} from '@/lib/validations/inventory/asset-request'

describe('Asset Request Validations', () => {
  describe('createAssetRequestSchema', () => {
    it('should accept valid asset request data', () => {
      const validData = {
        assetType: AssetType.EQUIPMENT,
        description: 'Need a new laptop for development work',
        familyId: '123e4567-e89b-12d3-a456-426614174000',
        justification: 'Current laptop is outdated and slow',
        quantity: 1,
      }

      const result = createAssetRequestSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should accept valid data with optional fields', () => {
      const validData = {
        assetType: AssetType.LICENSE,
        description: 'Need Adobe Creative Cloud license',
        familyId: '123e4567-e89b-12d3-a456-426614174000',
        justification: 'Required for design work',
        assetId: '223e4567-e89b-12d3-a456-426614174001',
        quantity: 2,
        neededBy: '2026-12-31T23:59:59.000Z',
      }

      const result = createAssetRequestSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject description shorter than 10 characters', () => {
      const invalidData = {
        assetType: AssetType.EQUIPMENT,
        description: 'Short',
        familyId: '123e4567-e89b-12d3-a456-426614174000',
        justification: 'Valid justification text here',
      }

      const result = createAssetRequestSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('al menos 10 caracteres')
      }
    })

    it('should reject justification shorter than 10 characters', () => {
      const invalidData = {
        assetType: AssetType.EQUIPMENT,
        description: 'Valid description text here',
        familyId: '123e4567-e89b-12d3-a456-426614174000',
        justification: 'Short',
      }

      const result = createAssetRequestSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('al menos 10 caracteres')
      }
    })

    it('should reject invalid familyId format', () => {
      const invalidData = {
        assetType: AssetType.EQUIPMENT,
        description: 'Valid description text here',
        familyId: 'not-a-uuid',
        justification: 'Valid justification text here',
      }

      const result = createAssetRequestSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('inválido')
      }
    })

    it('should reject invalid assetType', () => {
      const invalidData = {
        assetType: 'INVALID_TYPE',
        description: 'Valid description text here',
        familyId: '123e4567-e89b-12d3-a456-426614174000',
        justification: 'Valid justification text here',
      }

      const result = createAssetRequestSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject quantity less than 1', () => {
      const invalidData = {
        assetType: AssetType.EQUIPMENT,
        description: 'Valid description text here',
        familyId: '123e4567-e89b-12d3-a456-426614174000',
        justification: 'Valid justification text here',
        quantity: 0,
      }

      const result = createAssetRequestSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('al menos 1')
      }
    })

    it('should reject invalid ISO 8601 date format', () => {
      const invalidData = {
        assetType: AssetType.EQUIPMENT,
        description: 'Valid description text here',
        familyId: '123e4567-e89b-12d3-a456-426614174000',
        justification: 'Valid justification text here',
        neededBy: '2026-12-31',
      }

      const result = createAssetRequestSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ISO 8601')
      }
    })

    it('should apply default quantity of 1 when not provided', () => {
      const validData = {
        assetType: AssetType.EQUIPMENT,
        description: 'Valid description text here',
        familyId: '123e4567-e89b-12d3-a456-426614174000',
        justification: 'Valid justification text here',
      }

      const result = createAssetRequestSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quantity).toBe(1)
      }
    })
  })

  describe('updateStatusSchema', () => {
    it('should accept valid status update', () => {
      const validData = {
        status: AssetRequestStatus.APPROVED,
        comment: 'Approved for immediate processing',
      }

      const result = updateStatusSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should accept status without comment', () => {
      const validData = {
        status: AssetRequestStatus.UNDER_REVIEW,
      }

      const result = updateStatusSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject invalid status', () => {
      const invalidData = {
        status: 'INVALID_STATUS',
      }

      const result = updateStatusSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('addCommentSchema', () => {
    it('should accept valid comment', () => {
      const validData = {
        comment: 'This is a valid comment',
      }

      const result = addCommentSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject empty comment', () => {
      const invalidData = {
        comment: '',
      }

      const result = addCommentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('no puede estar vacío')
      }
    })

    it('should reject comment exceeding 2000 characters', () => {
      const invalidData = {
        comment: 'a'.repeat(2001),
      }

      const result = addCommentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('2000 caracteres')
      }
    })

    it('should accept comment with exactly 2000 characters', () => {
      const validData = {
        comment: 'a'.repeat(2000),
      }

      const result = addCommentSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })

  describe('updateFamilyConfigSchema', () => {
    it('should accept true value', () => {
      const validData = {
        assetRequestsEnabled: true,
      }

      const result = updateFamilyConfigSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should accept false value', () => {
      const validData = {
        assetRequestsEnabled: false,
      }

      const result = updateFamilyConfigSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject non-boolean value', () => {
      const invalidData = {
        assetRequestsEnabled: 'true',
      }

      const result = updateFamilyConfigSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('booleano')
      }
    })

    it('should reject missing field', () => {
      const invalidData = {}

      const result = updateFamilyConfigSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('requerido')
      }
    })
  })

  describe('validateReviewerComment', () => {
    it('should return true for comment with exactly 10 characters', () => {
      expect(validateReviewerComment('1234567890')).toBe(true)
    })

    it('should return true for comment with more than 10 characters', () => {
      expect(validateReviewerComment('This is a valid reviewer comment')).toBe(true)
    })

    it('should return false for comment with less than 10 characters', () => {
      expect(validateReviewerComment('Short')).toBe(false)
    })

    it('should return false for empty comment', () => {
      expect(validateReviewerComment('')).toBe(false)
    })

    it('should return false for comment with exactly 9 characters', () => {
      expect(validateReviewerComment('123456789')).toBe(false)
    })
  })
})
