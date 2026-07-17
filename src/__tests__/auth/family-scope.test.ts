import {
  getTicketConsumerFamilyIds,
  getTicketOperationalFamilyIds,
  getTicketVisibilityFamilyIds,
  getPatrolOperationalFamilyIds,
  getPatrolVisibilityFamilyIds,
  getInventoryOperationalFamilyIds,
  getInventoryVisibilityFamilyIds,
  getInventoryConsumerFamilyIds,
  isFamilyInScope,
} from '@/lib/auth/family-scope'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn() },
    client_family_assignments: { findMany: jest.fn().mockResolvedValue([]) },
    technician_family_assignments: { findMany: jest.fn().mockResolvedValue([]) },
    admin_family_assignments: { findMany: jest.fn().mockResolvedValue([]) },
    patrol_family_assignments: { findMany: jest.fn().mockResolvedValue([]) },
    inventory_manager_families: { findMany: jest.fn().mockResolvedValue([]) },
    departments: { findMany: jest.fn().mockResolvedValue([]) },
  },
}))

jest.mock('@/lib/auth/admin-scope', () => ({
  getModuleFamilyIds: jest.fn().mockResolvedValue([]),
}))

import prisma from '@/lib/prisma'

const nativeFamily = 'family-native'
const extraFamily = 'family-extra'

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
    departments: { familyId: nativeFamily },
  })
})

describe('family-scope tickets', () => {
  it('operational solo incluye familia nativa para técnico', async () => {
    ;(prisma.technician_family_assignments.findMany as jest.Mock).mockResolvedValue([
      { familyId: extraFamily },
    ])

    const operational = await getTicketOperationalFamilyIds('tech-1', 'TECHNICIAN', false)
    expect(operational).toEqual([nativeFamily])
  })

  it('consumer incluye nativa y adicionales para técnico', async () => {
    ;(prisma.technician_family_assignments.findMany as jest.Mock).mockResolvedValue([
      { familyId: extraFamily },
    ])

    const consumer = await getTicketConsumerFamilyIds('tech-1', 'TECHNICIAN', false)
    expect(consumer).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })

  it('admin visibility = solo nativa (asignadas son consumer, no cola)', async () => {
    ;(prisma.admin_family_assignments.findMany as jest.Mock).mockResolvedValue([
      { familyId: extraFamily },
    ])

    const visibility = await getTicketVisibilityFamilyIds('admin-1', 'ADMIN', false)
    expect(visibility).toEqual([nativeFamily])
    expect(visibility).not.toContain(extraFamily)
  })

  it('tech visibility = solo nativa', async () => {
    ;(prisma.technician_family_assignments.findMany as jest.Mock).mockResolvedValue([
      { familyId: extraFamily },
    ])

    const visibility = await getTicketVisibilityFamilyIds('tech-1', 'TECHNICIAN', false)
    expect(visibility).toEqual([nativeFamily])
    expect(visibility).not.toContain(extraFamily)
  })

  it('admin consumer incluye nativa y asignadas', async () => {
    ;(prisma.admin_family_assignments.findMany as jest.Mock).mockResolvedValue([
      { familyId: extraFamily },
    ])

    const consumer = await getTicketConsumerFamilyIds('admin-1', 'ADMIN', false)
    expect(consumer).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })

  it('client consumer incluye nativa y client assignments', async () => {
    ;(prisma.client_family_assignments.findMany as jest.Mock).mockResolvedValue([
      { familyId: extraFamily },
    ])

    const consumer = await getTicketConsumerFamilyIds('client-1', 'CLIENT', false)
    expect(consumer).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })

  it('admin operational solo nativa', async () => {
    ;(prisma.admin_family_assignments.findMany as jest.Mock).mockResolvedValue([
      { familyId: extraFamily },
    ])

    const operational = await getTicketOperationalFamilyIds('admin-1', 'ADMIN', false)
    expect(operational).toEqual([nativeFamily])
    expect(operational).not.toContain(extraFamily)
  })

  it('isFamilyInScope respeta undefined como acceso total', () => {
    expect(isFamilyInScope('any', undefined)).toBe(true)
    expect(isFamilyInScope('x', [nativeFamily])).toBe(false)
  })
})

describe('family-scope patrols', () => {
  it('admin operational solo nativa; visibility incluye módulo', async () => {
    const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
    ;(getModuleFamilyIds as jest.Mock).mockResolvedValue([extraFamily])

    const operational = await getPatrolOperationalFamilyIds('admin-1', 'ADMIN', false)
    const visibility = await getPatrolVisibilityFamilyIds('admin-1', 'ADMIN', false)

    expect(operational).toEqual([nativeFamily])
    expect(visibility).toEqual(expect.arrayContaining([extraFamily]))
    expect(operational).not.toContain(extraFamily)
  })

  it('agente patrulla en nativa y patrol assignments', async () => {
    ;(prisma.patrol_family_assignments.findMany as jest.Mock).mockResolvedValue([
      { familyId: extraFamily },
    ])

    const operational = await getPatrolOperationalFamilyIds('agent-1', 'TECHNICIAN', false)
    expect(operational).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })
})

describe('family-scope inventory', () => {
  it('admin operational solo nativa', async () => {
    const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
    ;(getModuleFamilyIds as jest.Mock).mockResolvedValue([extraFamily])

    const operational = await getInventoryOperationalFamilyIds('admin-1', 'ADMIN', false, false)
    const visibility = await getInventoryVisibilityFamilyIds('admin-1', 'ADMIN', false, false)

    expect(operational).toEqual([nativeFamily])
    expect(visibility).toEqual(expect.arrayContaining([extraFamily]))
  })

  it('gestor opera en nativa e inventory_manager_families', async () => {
    ;(prisma.inventory_manager_families.findMany as jest.Mock).mockResolvedValue([
      { familyId: extraFamily },
    ])

    const operational = await getInventoryOperationalFamilyIds('mgr-1', 'TECHNICIAN', false, true)
    expect(operational).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })

  it('consumer incluye client assignments', async () => {
    ;(prisma.client_family_assignments.findMany as jest.Mock).mockResolvedValue([
      { familyId: extraFamily },
    ])

    const consumer = await getInventoryConsumerFamilyIds('client-1', 'CLIENT', false)
    expect(consumer).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })
})
