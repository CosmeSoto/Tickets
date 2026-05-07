/**
 * Security verification test for /api/public/assets-for-sale
 * This test verifies that the API select statement doesn't include sensitive fields
 */

import { prisma } from '@/lib/prisma'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    system_settings: {
      findUnique: jest.fn(),
    },
    equipment: {
      findMany: jest.fn(),
    },
  },
}))

describe('Public API Security - Field Selection', () => {
  it('should verify that Prisma select statement excludes sensitive fields', async () => {
    // This test verifies the structure of the Prisma query
    // by checking what fields are requested in the select clause

    const mockFindMany = prisma.equipment.findMany as jest.Mock
    mockFindMany.mockResolvedValue([])

    // Import the route handler
    const { GET } = await import('@/app/api/public/assets-for-sale/route')

    // Mock system settings
    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue(null)

    // Create a mock request object that doesn't use NextRequest
    const mockRequest = {
      nextUrl: {
        searchParams: {
          get: jest.fn().mockReturnValue(null),
        },
      },
    } as any

    try {
      await GET(mockRequest)
    } catch (error) {
      // Ignore errors - we're only interested in the Prisma call
    }

    // Verify that findMany was called
    expect(mockFindMany).toHaveBeenCalled()

    // Get the call arguments
    const callArgs = mockFindMany.mock.calls[0][0]

    // Verify that select clause exists
    expect(callArgs).toHaveProperty('select')

    const selectClause = callArgs.select

    // Verify PUBLIC fields are included
    expect(selectClause).toHaveProperty('id', true)
    expect(selectClause).toHaveProperty('code', true)
    expect(selectClause).toHaveProperty('brand', true)
    expect(selectClause).toHaveProperty('model', true)
    expect(selectClause).toHaveProperty('condition', true)
    expect(selectClause).toHaveProperty('photoUrl', true)
    expect(selectClause).toHaveProperty('specifications', true)
    expect(selectClause).toHaveProperty('accessories', true)
    expect(selectClause).toHaveProperty('notes', true)
    expect(selectClause).toHaveProperty('saleListingPrice', true)
    expect(selectClause).toHaveProperty('updatedAt', true)
    expect(selectClause).toHaveProperty('type')

    // Verify SENSITIVE fields are NOT included
    expect(selectClause).not.toHaveProperty('purchasePrice')
    expect(selectClause).not.toHaveProperty('purchaseDate')
    expect(selectClause).not.toHaveProperty('invoiceNumber')
    expect(selectClause).not.toHaveProperty('serialNumber')
    expect(selectClause).not.toHaveProperty('departmentId')
    expect(selectClause).not.toHaveProperty('supplierId')
    expect(selectClause).not.toHaveProperty('usefulLifeYears')
    expect(selectClause).not.toHaveProperty('residualValue')
    expect(selectClause).not.toHaveProperty('depreciationMethod')
    expect(selectClause).not.toHaveProperty('rentalProvider')
    expect(selectClause).not.toHaveProperty('contractId')
    expect(selectClause).not.toHaveProperty('warehouseId')
  })

  it('should verify that the where clause filters by FOR_SALE status', async () => {
    const mockFindMany = prisma.equipment.findMany as jest.Mock
    mockFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/public/assets-for-sale/route')

    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue(null)

    const mockRequest = {
      nextUrl: {
        searchParams: {
          get: jest.fn().mockReturnValue(null),
        },
      },
    } as any

    try {
      await GET(mockRequest)
    } catch (error) {
      // Ignore errors
    }

    const callArgs = mockFindMany.mock.calls[0][0]

    // Verify that where clause filters by FOR_SALE status
    expect(callArgs).toHaveProperty('where')
    expect(callArgs.where).toHaveProperty('status', 'FOR_SALE')
  })

  it('should verify that type.family.contactWhatsapp is included in select', async () => {
    const mockFindMany = prisma.equipment.findMany as jest.Mock
    mockFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/public/assets-for-sale/route')

    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue(null)

    const mockRequest = {
      nextUrl: {
        searchParams: {
          get: jest.fn().mockReturnValue(null),
        },
      },
    } as any

    try {
      await GET(mockRequest)
    } catch (error) {
      // Ignore errors
    }

    const callArgs = mockFindMany.mock.calls[0][0]
    const selectClause = callArgs.select

    // Verify that type.family.contactWhatsapp is included
    expect(selectClause.type).toHaveProperty('select')
    expect(selectClause.type.select).toHaveProperty('family')
    expect(selectClause.type.select.family).toHaveProperty('select')
    expect(selectClause.type.select.family.select).toHaveProperty('contactWhatsapp', true)
  })
})
