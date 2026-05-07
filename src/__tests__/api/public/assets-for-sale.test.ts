/**
 * Test suite for /api/public/assets-for-sale
 * Verifies that the public API doesn't expose sensitive fields
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/public/assets-for-sale/route'
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

describe('GET /api/public/assets-for-sale', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not expose sensitive fields in the response', async () => {
    // Mock system settings
    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue({
      key: 'contact.whatsapp_number',
      value: '593999999999',
    })

    // Mock equipment data with ALL fields (including sensitive ones)
    const mockEquipmentWithSensitiveData = [
      {
        id: '1',
        code: 'TECH-LAP-OWN-2024-0001',
        brand: 'Dell',
        model: 'Latitude 5420',
        condition: 'GOOD',
        photoUrl: 'https://example.com/photo.jpg',
        specifications: { processor: 'Intel Core i5', ram: '16GB' },
        accessories: ['Cargador', 'Mouse'],
        notes: 'Equipo en buen estado',
        saleListingPrice: 850.5,
        updatedAt: new Date('2024-01-01'),
        // Sensitive fields that should NOT be exposed
        purchasePrice: 1200.0,
        purchaseDate: new Date('2023-01-01'),
        invoiceNumber: 'INV-12345',
        serialNumber: 'SN123456789',
        departmentId: 'dept-1',
        supplierId: 'supplier-1',
        usefulLifeYears: 5,
        residualValue: 100.0,
        depreciationMethod: 'STRAIGHT_LINE',
        rentalProvider: 'Provider XYZ',
        contractId: 'contract-1',
        warehouseId: 'warehouse-1',
        type: {
          id: 'type-1',
          name: 'Laptop',
          family: {
            id: 'family-1',
            name: 'Tecnología',
            icon: 'Laptop',
            color: 'blue',
            contactWhatsapp: '593987654321',
          },
        },
      },
    ]

    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue(mockEquipmentWithSensitiveData)

    // Create mock request
    const url = new URL('http://localhost:3000/api/public/assets-for-sale')
    const request = new NextRequest(url)

    // Call the API
    const response = await GET(request)
    const data = await response.json()

    // Verify response structure
    expect(data).toHaveProperty('items')
    expect(Array.isArray(data.items)).toBe(true)
    expect(data.items).toHaveLength(1)

    const item = data.items[0]

    // Verify PUBLIC fields are present
    expect(item).toHaveProperty('id')
    expect(item).toHaveProperty('code')
    expect(item).toHaveProperty('brand')
    expect(item).toHaveProperty('model')
    expect(item).toHaveProperty('condition')
    expect(item).toHaveProperty('photoUrl')
    expect(item).toHaveProperty('specifications')
    expect(item).toHaveProperty('accessories')
    expect(item).toHaveProperty('notes')
    expect(item).toHaveProperty('saleListingPrice')
    expect(item).toHaveProperty('updatedAt')
    expect(item).toHaveProperty('type')
    expect(item).toHaveProperty('contactWhatsapp')

    // Verify SENSITIVE fields are NOT present
    expect(item).not.toHaveProperty('purchasePrice')
    expect(item).not.toHaveProperty('purchaseDate')
    expect(item).not.toHaveProperty('invoiceNumber')
    expect(item).not.toHaveProperty('serialNumber')
    expect(item).not.toHaveProperty('departmentId')
    expect(item).not.toHaveProperty('supplierId')
    expect(item).not.toHaveProperty('usefulLifeYears')
    expect(item).not.toHaveProperty('residualValue')
    expect(item).not.toHaveProperty('depreciationMethod')
    expect(item).not.toHaveProperty('rentalProvider')
    expect(item).not.toHaveProperty('contractId')
    expect(item).not.toHaveProperty('warehouseId')
  })

  it('should filter by familyId when provided', async () => {
    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([])

    const url = new URL('http://localhost:3000/api/public/assets-for-sale?familyId=family-1')
    const request = new NextRequest(url)

    await GET(request)

    expect(prisma.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'FOR_SALE',
          type: { familyId: 'family-1' },
        }),
      })
    )
  })

  it('should filter by typeId when provided', async () => {
    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([])

    const url = new URL('http://localhost:3000/api/public/assets-for-sale?typeId=type-1')
    const request = new NextRequest(url)

    await GET(request)

    expect(prisma.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'FOR_SALE',
          typeId: 'type-1',
        }),
      })
    )
  })

  it('should filter by condition when provided', async () => {
    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([])

    const url = new URL('http://localhost:3000/api/public/assets-for-sale?condition=GOOD')
    const request = new NextRequest(url)

    await GET(request)

    expect(prisma.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'FOR_SALE',
          condition: 'GOOD',
        }),
      })
    )
  })

  it('should limit results when limit parameter is provided', async () => {
    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([])

    const url = new URL('http://localhost:3000/api/public/assets-for-sale?limit=6')
    const request = new NextRequest(url)

    await GET(request)

    expect(prisma.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 6,
      })
    )
  })

  it('should resolve contactWhatsapp with family number', async () => {
    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue({
      key: 'contact.whatsapp_number',
      value: '593999999999',
    })

    const mockEquipment = [
      {
        id: '1',
        code: 'TEST-001',
        brand: 'Test',
        model: 'Model',
        condition: 'GOOD',
        photoUrl: null,
        specifications: {},
        accessories: [],
        notes: null,
        saleListingPrice: 100,
        updatedAt: new Date(),
        type: {
          id: 'type-1',
          name: 'Type',
          family: {
            id: 'family-1',
            name: 'Family',
            icon: null,
            color: null,
            contactWhatsapp: '593987654321', // Family-specific number
          },
        },
      },
    ]

    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue(mockEquipment)

    const url = new URL('http://localhost:3000/api/public/assets-for-sale')
    const request = new NextRequest(url)

    const response = await GET(request)
    const data = await response.json()

    // Should use family-specific number, not global
    expect(data.items[0].contactWhatsapp).toBe('593987654321')
  })

  it('should fallback to global whatsapp when family has no number', async () => {
    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue({
      key: 'contact.whatsapp_number',
      value: '593999999999',
    })

    const mockEquipment = [
      {
        id: '1',
        code: 'TEST-001',
        brand: 'Test',
        model: 'Model',
        condition: 'GOOD',
        photoUrl: null,
        specifications: {},
        accessories: [],
        notes: null,
        saleListingPrice: 100,
        updatedAt: new Date(),
        type: {
          id: 'type-1',
          name: 'Type',
          family: {
            id: 'family-1',
            name: 'Family',
            icon: null,
            color: null,
            contactWhatsapp: null, // No family-specific number
          },
        },
      },
    ]

    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue(mockEquipment)

    const url = new URL('http://localhost:3000/api/public/assets-for-sale')
    const request = new NextRequest(url)

    const response = await GET(request)
    const data = await response.json()

    // Should use global number
    expect(data.items[0].contactWhatsapp).toBe('593999999999')
  })

  it('should return null contactWhatsapp when no numbers are configured', async () => {
    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue(null)

    const mockEquipment = [
      {
        id: '1',
        code: 'TEST-001',
        brand: 'Test',
        model: 'Model',
        condition: 'GOOD',
        photoUrl: null,
        specifications: {},
        accessories: [],
        notes: null,
        saleListingPrice: 100,
        updatedAt: new Date(),
        type: {
          id: 'type-1',
          name: 'Type',
          family: {
            id: 'family-1',
            name: 'Family',
            icon: null,
            color: null,
            contactWhatsapp: null,
          },
        },
      },
    ]

    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue(mockEquipment)

    const url = new URL('http://localhost:3000/api/public/assets-for-sale')
    const request = new NextRequest(url)

    const response = await GET(request)
    const data = await response.json()

    // Should be null (frontend will redirect to /login)
    expect(data.items[0].contactWhatsapp).toBeNull()
  })

  it('should return empty array when no FOR_SALE items exist', async () => {
    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([])

    const url = new URL('http://localhost:3000/api/public/assets-for-sale')
    const request = new NextRequest(url)

    const response = await GET(request)
    const data = await response.json()

    expect(data.items).toEqual([])
    expect(response.status).toBe(200)
  })

  it('should handle errors gracefully', async () => {
    ;(prisma.system_settings.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'))

    const url = new URL('http://localhost:3000/api/public/assets-for-sale')
    const request = new NextRequest(url)

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
  })
})
