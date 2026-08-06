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
    families: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(async ({ where }: { where?: { id?: { in?: string[] } } }) => {
        const ids = where?.id?.in ?? []
        return ids.map((id: string) => ({ id }))
      }),
    },
    departments: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    user_family_access: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  },
}))

jest.mock('@/lib/auth/admin-scope', () => ({
  getModuleFamilyIds: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/auth/user-family-access', () => ({
  getUserModuleFamilyGrantIds: jest.fn().mockResolvedValue([]),
  resolveModuleFamilyScopeIds: jest.fn(),
  syncUserModuleFamilyAccess: jest.fn().mockResolvedValue(0),
}))

import prisma from '@/lib/prisma'
import { getUserModuleFamilyGrantIds } from '@/lib/auth/user-family-access'

const nativeFamily = 'family-native'
const extraFamily = 'family-extra'

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
    role: 'TECHNICIAN',
    departmentId: null,
    departments: { familyId: nativeFamily },
  })
  ;(prisma.families.findUnique as jest.Mock).mockResolvedValue(null)
  ;(prisma.families.findMany as jest.Mock).mockImplementation(
    async ({ where }: { where?: { id?: { in?: string[] } } }) => {
      const ids = where?.id?.in ?? []
      return ids.map((id: string) => ({ id }))
    }
  )
  ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([])
})

describe('family-scope tickets', () => {
  it('operational solo incluye familia nativa para técnico', async () => {
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([extraFamily])

    const operational = await getTicketOperationalFamilyIds('tech-1', 'TECHNICIAN', false)
    expect(operational).toEqual([nativeFamily])
  })

  it('consumer incluye nativa y adicionales para técnico', async () => {
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([extraFamily])

    const consumer = await getTicketConsumerFamilyIds('tech-1', 'TECHNICIAN', false)
    expect(consumer).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })

  it('admin visibility = solo nativa (asignadas son consumer, no cola)', async () => {
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      role: 'ADMIN',
      departmentId: null,
      departments: { familyId: nativeFamily },
    })
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([extraFamily])

    const visibility = await getTicketVisibilityFamilyIds('admin-1', 'ADMIN', false)
    expect(visibility).toEqual([nativeFamily])
    expect(visibility).not.toContain(extraFamily)
  })

  it('tech visibility = solo nativa', async () => {
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([extraFamily])

    const visibility = await getTicketVisibilityFamilyIds('tech-1', 'TECHNICIAN', false)
    expect(visibility).toEqual([nativeFamily])
    expect(visibility).not.toContain(extraFamily)
  })

  it('admin consumer incluye nativa y asignadas', async () => {
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      role: 'ADMIN',
      departmentId: null,
      departments: { familyId: nativeFamily },
    })
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([extraFamily])

    const consumer = await getTicketConsumerFamilyIds('admin-1', 'ADMIN', false)
    expect(consumer).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })

  it('client consumer incluye nativa y grants tickets', async () => {
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      role: 'CLIENT',
      departmentId: null,
      departments: { familyId: nativeFamily },
    })
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([extraFamily])

    const consumer = await getTicketConsumerFamilyIds('client-1', 'CLIENT', false)
    expect(consumer).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })

  it('admin operational solo nativa', async () => {
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      role: 'ADMIN',
      departmentId: null,
      departments: { familyId: nativeFamily },
    })
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([extraFamily])

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
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      role: 'ADMIN',
      departmentId: null,
      departments: { familyId: nativeFamily },
    })
    const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
    ;(getModuleFamilyIds as jest.Mock).mockResolvedValue([extraFamily])

    const operational = await getPatrolOperationalFamilyIds('admin-1', 'ADMIN', false)
    const visibility = await getPatrolVisibilityFamilyIds('admin-1', 'ADMIN', false)

    expect(operational).toEqual([nativeFamily])
    expect(visibility).toEqual(expect.arrayContaining([extraFamily]))
    expect(operational).not.toContain(extraFamily)
  })

  it('agente patrulla en nativa y grants patrols', async () => {
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockImplementation(
      async (_userId: string, moduleInput: string) =>
        moduleInput === 'patrols' ? [extraFamily] : []
    )

    const operational = await getPatrolOperationalFamilyIds('agent-1', 'TECHNICIAN', false)
    expect(operational).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })
})

describe('family-scope inventory', () => {
  it('admin operational solo nativa', async () => {
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      role: 'ADMIN',
      departmentId: null,
      departments: { familyId: nativeFamily },
    })
    const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
    ;(getModuleFamilyIds as jest.Mock).mockResolvedValue([extraFamily])

    const operational = await getInventoryOperationalFamilyIds('admin-1', 'ADMIN', false, false)
    const visibility = await getInventoryVisibilityFamilyIds('admin-1', 'ADMIN', false, false)

    expect(operational).toEqual([nativeFamily])
    expect(visibility).toEqual(expect.arrayContaining([extraFamily]))
  })

  it('gestor opera en nativa y grants inventory', async () => {
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockImplementation(
      async (_userId: string, moduleInput: string) =>
        moduleInput === 'inventory' ? [extraFamily] : []
    )

    const operational = await getInventoryOperationalFamilyIds('mgr-1', 'TECHNICIAN', false, true)
    expect(operational).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })

  it('consumer incluye grants tickets', async () => {
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      role: 'CLIENT',
      departmentId: null,
      departments: { familyId: nativeFamily },
    })
    ;(getUserModuleFamilyGrantIds as jest.Mock).mockResolvedValue([extraFamily])

    const consumer = await getInventoryConsumerFamilyIds('client-1', 'CLIENT', false)
    expect(consumer).toEqual(expect.arrayContaining([nativeFamily, extraFamily]))
  })
})
