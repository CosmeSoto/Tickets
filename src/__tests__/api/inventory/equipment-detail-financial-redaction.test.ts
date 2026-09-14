/**
 * GET /api/inventory/equipment/[id]
 *
 * `hasAccessToEquipment` da acceso de lectura a un CLIENT con el equipo
 * asignado (ese es su propósito: "mi equipo asignado") — pero
 * `EquipmentService.getEquipmentDetail` no proyecta columnas, así que la
 * respuesta incluía TODOS los campos del modelo: precio de compra, número
 * de factura/orden de compra, costo mensual de renta, valor residual, y el
 * RUT/tax ID del proveedor. Nada de eso es asunto de quien solo tiene el
 * equipo asignado.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/inventory-access', () => ({
  canManageInventory: jest.fn(),
  canManageAsset: jest.fn(),
  inventoryForbidden: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/inventory/depreciation', () => ({ calculateDepreciation: jest.fn() }))
jest.mock('@/lib/inventory/family-config', () => ({
  getFamilyConfig: jest.fn().mockResolvedValue({}),
}))
jest.mock('@/lib/inventory/family-config-types', () => ({
  resolveSectionsForMode: jest.fn().mockReturnValue({ visible: [] }),
}))
jest.mock('@/lib/inventory/equipment-contract', () => ({
  syncEquipmentContractLink: jest.fn(),
  getLinkedBusinessContractId: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/utils/equipment-display', () => ({ getEquipmentDisplayName: jest.fn() }))
jest.mock('@/lib/inventory/invoice-number', () => ({
  isValidInvoiceNumber: jest.fn(),
  INVOICE_NUMBER_ERROR: 'invalid',
}))
jest.mock('@/lib/middleware/family-filter', () => ({ hasAccessToEquipment: jest.fn() }))
jest.mock('@/lib/inventory/inventory-resource-access', () => ({
  assertResourceTypeChangeAllowed: jest.fn(),
  InventoryAccessError: class InventoryAccessError extends Error {},
  inventoryAccessToResponse: jest.fn(),
  toInventoryAccessUser: (u: any) => u,
}))
jest.mock('@/lib/validations/inventory/equipment', () => ({
  equipmentIdSchema: { parse: (x: any) => x },
  updateEquipmentSchema: { parse: (x: any) => x },
}))
jest.mock('@/lib/services/equipment.service', () => ({
  EquipmentService: { getEquipmentDetail: jest.fn() },
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

import { getServerSession } from 'next-auth'
import { hasAccessToEquipment } from '@/lib/middleware/family-filter'
import { EquipmentService } from '@/lib/services/equipment.service'
import { GET } from '@/app/api/inventory/equipment/[id]/route'

const EQUIPMENT_ID = 'eq-1'

function params() {
  return { params: Promise.resolve({ id: EQUIPMENT_ID }) }
}

function detailFixture() {
  return {
    equipment: {
      id: EQUIPMENT_ID,
      code: 'EQ-1',
      type: { familyId: 'fam-1' },
      purchasePrice: 1500,
      estimatedPrice: 1600,
      invoiceNumber: 'F-001-0001',
      purchaseOrderNumber: 'OC-9',
      rentalMonthlyCost: 50,
      rentalBuyoutValue: 200,
      residualValue: 100,
      saleListingPrice: 900,
      supplier: { id: 'sup-1', name: 'ACME', taxId: '1234567-8' },
    },
    currentAssignment: null,
    history: [],
    maintenanceRecords: [],
    batch: { id: 'batch-1', batchCode: 'B-1', unitPrice: 120 },
    batchMetrics: undefined,
  }
}

describe('GET /api/inventory/equipment/[id] — redacción financiera para CLIENT', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(hasAccessToEquipment as jest.Mock).mockResolvedValue(true)
    ;(EquipmentService.getEquipmentDetail as jest.Mock).mockResolvedValue(detailFixture())
  })

  it('regresión: un CLIENT con el equipo asignado no recibe precio de compra, factura, renta ni taxId del proveedor', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT', isSuperAdmin: false },
    })

    const res = await GET({} as any, params())
    const body = await res.json()

    expect(body.equipment.purchasePrice).toBeUndefined()
    expect(body.equipment.estimatedPrice).toBeUndefined()
    expect(body.equipment.invoiceNumber).toBeUndefined()
    expect(body.equipment.purchaseOrderNumber).toBeUndefined()
    expect(body.equipment.rentalMonthlyCost).toBeUndefined()
    expect(body.equipment.rentalBuyoutValue).toBeUndefined()
    expect(body.equipment.residualValue).toBeUndefined()
    expect(body.equipment.saleListingPrice).toBeUndefined()
    expect(body.equipment.supplier).toEqual({ id: 'sup-1', name: 'ACME' })
    expect(body.batch.unitPrice).toBeUndefined()
    // Lo no financiero sigue disponible
    expect(body.equipment.code).toBe('EQ-1')
    expect(body.batch.batchCode).toBe('B-1')
  })

  it('un ADMIN ve la información financiera completa, sin redactar', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: true },
    })

    const res = await GET({} as any, params())
    const body = await res.json()

    expect(body.equipment.purchasePrice).toBe(1500)
    expect(body.equipment.supplier).toEqual({ id: 'sup-1', name: 'ACME', taxId: '1234567-8' })
    expect(body.batch.unitPrice).toBe(120)
  })
})
