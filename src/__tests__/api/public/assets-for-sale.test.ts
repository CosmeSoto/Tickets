/**
 * Tests for GET /api/public/assets-for-sale
 *
 * Mockea next/server: el NextResponse/NextRequest reales no funcionan bajo
 * next/jest + jsdom en este proyecto (confirmado de forma aislada — el
 * NextResponse real que devuelve la ruta no implementa `.json()` ni
 * `.clone()` en este entorno), el mismo problema que motivó mockear
 * next/server en el resto de tests de rutas API del repo.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
  NextRequest: class {
    nextUrl: URL
    constructor(url: string | URL) {
      this.nextUrl = typeof url === 'string' ? new URL(url) : url
    }
  },
}))

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/public/assets-for-sale/route'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => {
  const p = {
    equipment: { findMany: jest.fn() },
    system_settings: { findMany: jest.fn().mockResolvedValue([]) },
    landing_page_content: {
      findFirst: jest.fn().mockResolvedValue({ socialWhatsapp: null, contactPhone: null }),
    },
  }
  return { __esModule: true, default: p, prisma: p }
})

function baseEquipmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    code: 'TEST-001',
    serialNumber: 'SN1',
    brand: 'Dell',
    model: { id: 'm1', brand: 'Dell', model: 'Latitude 5420' },
    condition: 'GOOD',
    photoUrl: 'https://example.com/p.jpg',
    accessories: [] as string[],
    notes: null,
    saleListingPrice: 100,
    createdAt: new Date('2024-01-01'),
    purchasePrice: 999,
    type: {
      id: 'type-1',
      name: 'Laptop',
      code: 'LAP',
      familyId: 'family-1',
      family: {
        id: 'family-1',
        name: 'Tecnología',
        icon: null,
        color: null,
        contactWhatsapp: '593987654321',
      },
      attributes: [] as unknown[],
    },
    customValues: [] as unknown[],
    ...overrides,
  }
}

describe('GET /api/public/assets-for-sale', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 and omits sensitive fields from grouped units', async () => {
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([baseEquipmentRow()])

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.items)).toBe(true)
    expect(data.items.length).toBeGreaterThan(0)
    const unit = data.items[0].units[0]
    expect(unit).not.toHaveProperty('purchasePrice')
    expect(unit).toHaveProperty('code', 'TEST-001')
  })

  it('returns empty items when no FOR_SALE rows', async () => {
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([])

    const res = await GET()
    const data = await res.json()
    expect(data.items).toEqual([])
  })

  it('passes optional query filters to Prisma when request is provided', async () => {
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([])

    // 'GOOD' no es un EquipmentCondition válido (NEW/USED/DAMAGED) — la ruta lo
    // descarta a propósito (whitelist contra el enum real), así que el filtro
    // de prueba debe usar un valor válido para verificar que sí se propaga.
    const url = new URL(
      'http://localhost/api/public/assets-for-sale?familyId=fam-1&typeId=t-1&condition=USED&limit=5'
    )
    await GET(new NextRequest(url))

    expect(prisma.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'FOR_SALE',
          type: { familyId: 'fam-1' },
          typeId: 't-1',
          condition: 'USED',
        }),
        take: 5,
      })
    )
  })

  it('skips invalid equipment rows and still returns 200', async () => {
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([
      baseEquipmentRow({ type: null }),
      baseEquipmentRow({
        id: '2',
        code: 'TEST-002',
        type: {
          ...baseEquipmentRow().type,
          family: null,
          familyId: null,
          attributes: undefined,
        },
      }),
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toBeDefined()
    expect(Array.isArray(data.items)).toBe(true)
  })

  it('uses family contactWhatsapp on grouped units', async () => {
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([baseEquipmentRow()])

    const res = await GET()
    const data = await res.json()
    const unit = data.items[0].units[0]
    expect(unit.contactWhatsapp).toBe('593987654321')
    expect(data.items[0].contactWhatsapp).toBe('593987654321')
  })

  it('falls back to landing WhatsApp when family has none', async () => {
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([
      baseEquipmentRow({
        type: {
          ...baseEquipmentRow().type,
          family: {
            id: 'family-1',
            name: 'Tecnología',
            icon: null,
            color: null,
            contactWhatsapp: null,
          },
        },
      }),
    ])
    ;(prisma.landing_page_content.findFirst as jest.Mock).mockResolvedValue({
      socialWhatsapp: 'https://wa.me/593111122233',
      contactPhone: null,
    })

    const res = await GET()
    const data = await res.json()
    expect(data.items[0].units[0].contactWhatsapp).toBe('593111122233')
    expect(data.contactWhatsapp).toBe('593111122233')
  })
})
