import {
  sanitizeInventoryConfigBody,
  sanitizePatrolConfigBody,
  sanitizeTicketConfigBody,
} from '@/lib/auth/module-config-access'

describe('module-config-access sanitizers', () => {
  it('sanitizeInventoryConfigBody quita inventoryEnabled si no es super admin', () => {
    const body = { inventoryEnabled: false, codePrefix: 'IT' }
    expect(sanitizeInventoryConfigBody(body, false)).toEqual({ codePrefix: 'IT' })
    expect(sanitizeInventoryConfigBody(body, true)).toEqual(body)
  })

  it('sanitizeTicketConfigBody quita ticketsEnabled e isDefault', () => {
    const body = { ticketsEnabled: false, isDefault: true, codePrefix: 'TK' }
    expect(sanitizeTicketConfigBody(body, false)).toEqual({ codePrefix: 'TK' })
    expect(sanitizeTicketConfigBody(body, true)).toEqual(body)
  })

  it('sanitizePatrolConfigBody quita patrolsEnabled', () => {
    const body = { patrolsEnabled: false, gracePeriodMinutes: 10 }
    expect(sanitizePatrolConfigBody(body, false)).toEqual({ gracePeriodMinutes: 10 })
    expect(sanitizePatrolConfigBody(body, true)).toEqual(body)
  })
})

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { users: { findUnique: jest.fn() } },
}))

jest.mock('@/lib/auth/family-scope', () => ({
  adminCanOperateInventoryFamily: jest.fn(),
  adminCanOperatePatrolFamily: jest.fn(),
  adminCanOperateTicketFamily: jest.fn(),
  adminCanViewTicketFamily: jest.fn(),
}))

jest.mock('@/lib/inventory/family-access', () => ({
  checkFamilyAccess: jest.fn(),
}))

jest.mock('@/lib/patrol/patrol-access', () => ({
  checkPatrolFamilyAccess: jest.fn(),
}))

jest.mock('@/lib/inventory-access', () => ({
  canManageInventory: jest.fn(),
}))

import {
  canReadModuleFamilyConfig,
  canWriteModuleFamilyConfig,
} from '@/lib/auth/module-config-access'
import {
  adminCanOperateInventoryFamily,
  adminCanOperateTicketFamily,
  adminCanViewTicketFamily,
} from '@/lib/auth/family-scope'
import { checkFamilyAccess } from '@/lib/inventory/family-access'

describe('module-config-access permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('escritura inventario: admin nativo sí, super admin sí', async () => {
    ;(adminCanOperateInventoryFamily as jest.Mock).mockResolvedValue(true)
    await expect(
      canWriteModuleFamilyConfig('admin-1', 'ADMIN', false, 'fam-1', 'inventory')
    ).resolves.toBe(true)

    await expect(
      canWriteModuleFamilyConfig('sa-1', 'ADMIN', true, 'fam-1', 'inventory')
    ).resolves.toBe(true)
  })

  it('escritura tickets: rechaza no-admin', async () => {
    await expect(
      canWriteModuleFamilyConfig('tech-1', 'TECHNICIAN', false, 'fam-1', 'tickets')
    ).resolves.toBe(false)
  })

  it('lectura tickets: admin con visibilidad', async () => {
    ;(adminCanViewTicketFamily as jest.Mock).mockResolvedValue(true)
    await expect(
      canReadModuleFamilyConfig('admin-1', 'ADMIN', false, 'fam-1', 'tickets')
    ).resolves.toBe(true)
  })

  it('lectura inventario: gestor con checkFamilyAccess', async () => {
    const { canManageInventory } = await import('@/lib/inventory-access')
    ;(canManageInventory as jest.Mock).mockResolvedValue(true)
    ;(checkFamilyAccess as jest.Mock).mockResolvedValue(true)

    await expect(
      canReadModuleFamilyConfig('mgr-1', 'TECHNICIAN', false, 'fam-1', 'inventory')
    ).resolves.toBe(true)
  })
})
