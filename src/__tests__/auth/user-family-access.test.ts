/**
 * Pruebas del servicio unificado user_family_access (capa de datos).
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    families: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(async ({ where }: { where?: { id?: { in?: string[] } } }) => {
        const ids = where?.id?.in ?? []
        return ids.map((id: string) => ({ id }))
      }),
    },
    departments: { findUnique: jest.fn().mockResolvedValue(null) },
    user_family_access: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  },
}))

import prisma from '@/lib/prisma'
import {
  assignUserModuleFamily,
  unassignUserModuleFamily,
  setUserModuleFamilies,
  getUserModuleFamilyGrantIds,
  syncUserModuleFamilyAccess,
  mirrorLegacyAssignmentToUnified,
  syncUnifiedModuleSetFromLegacy,
  resolveModuleFamilyScopeIds,
  userHasFamilyInModule,
  diagnoseUserFamilyAccessDrift,
} from '@/lib/auth/user-family-access'

const nativeFamily = 'fam-native'
const extraA = 'fam-a'
const extraB = 'fam-b'

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
  ;(prisma.user_family_access.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.user_family_access.count as jest.Mock).mockResolvedValue(0)
})

describe('user-family-access assign / unassign', () => {
  it('assign escribe solo user_family_access', async () => {
    await assignUserModuleFamily({
      userId: 'tech-1',
      familyId: extraA,
      moduleInput: 'tickets',
      role: 'TECHNICIAN',
    })

    expect(prisma.user_family_access.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_familyId_module: {
            userId: 'tech-1',
            familyId: extraA,
            module: 'tickets',
          },
        },
        create: expect.objectContaining({
          canConsume: true,
          canOperate: false,
          module: 'tickets',
        }),
      })
    )
    expect(prisma.user_family_access.upsert).toHaveBeenCalledTimes(1)
  })

  it('rechaza asignar la familia nativa como adicional', async () => {
    await expect(
      assignUserModuleFamily({
        userId: 'tech-1',
        familyId: nativeFamily,
        moduleInput: 'tickets',
        role: 'TECHNICIAN',
      })
    ).rejects.toThrow(/nativa/i)
  })

  it('unassign soft-delete solo en user_family_access', async () => {
    await unassignUserModuleFamily({
      userId: 'tech-1',
      familyId: extraA,
      moduleInput: 'tickets',
      role: 'TECHNICIAN',
    })

    expect(prisma.user_family_access.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'tech-1', familyId: extraA, module: 'tickets' },
        data: expect.objectContaining({ isActive: false }),
      })
    )
  })

  it('content: assign con canOperate true', async () => {
    await assignUserModuleFamily({
      userId: 'tech-1',
      familyId: extraA,
      moduleInput: 'news', // mapea a content
      role: 'TECHNICIAN',
    })

    expect(prisma.user_family_access.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ module: 'content', canOperate: true }),
      })
    )
  })
})

describe('user-family-access sync content desde tickets', () => {
  it('sync tickets no importa (solo content se siembra)', async () => {
    ;(prisma.user_family_access.count as jest.Mock).mockResolvedValue(0)

    const n = await syncUserModuleFamilyAccess('tech-1', 'tickets')
    expect(n).toBe(0)
    expect(prisma.user_family_access.upsert).not.toHaveBeenCalled()
  })

  it('sync content no reimporta si ya inicializado (count incluye inactivas)', async () => {
    ;(prisma.user_family_access.count as jest.Mock).mockResolvedValue(1)

    const n = await syncUserModuleFamilyAccess('tech-1', 'content')
    expect(n).toBe(0)
    expect(prisma.user_family_access.upsert).not.toHaveBeenCalled()
  })

  it('content seed desde grants tickets si nunca se inicializó', async () => {
    ;(prisma.user_family_access.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.user_family_access.findMany as jest.Mock).mockImplementation(
      async (args: { where?: { userId?: string; module?: string } }) => {
        if (args.where?.module === 'tickets') {
          return [{ familyId: extraA }]
        }
        return []
      }
    )

    const n = await syncUserModuleFamilyAccess('tech-1', 'content')
    expect(n).toBe(1)
    expect(prisma.user_family_access.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ module: 'content', familyId: extraA }),
      })
    )
  })
})

describe('user-family-access setUserModuleFamilies', () => {
  it('setUserModuleFamilies alinea adds/removes en user_family_access', async () => {
    ;(prisma.user_family_access.findMany as jest.Mock).mockResolvedValue([
      { familyId: extraA },
      { familyId: extraB },
    ])

    await setUserModuleFamilies({
      userId: 'mgr-1',
      moduleInput: 'inventory',
      familyIds: [extraA],
      role: 'TECHNICIAN',
    })

    expect(prisma.user_family_access.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          familyId: extraB,
          module: 'inventory',
        }),
      })
    )
  })
})

describe('user-family-access deprecated aliases', () => {
  it('mirrorLegacyAssignmentToUnified escribe solo unificado', async () => {
    await mirrorLegacyAssignmentToUnified({
      userId: 'tech-1',
      familyId: extraA,
      moduleInput: 'tickets',
      active: true,
      role: 'TECHNICIAN',
    })

    expect(prisma.user_family_access.upsert).toHaveBeenCalled()
  })

  it('syncUnifiedModuleSetFromLegacy delega a setUserModuleFamilies', async () => {
    ;(prisma.user_family_access.findMany as jest.Mock).mockResolvedValue([{ familyId: extraA }])

    await syncUnifiedModuleSetFromLegacy({
      userId: 'mgr-1',
      moduleInput: 'inventory',
      familyIds: [extraA],
      role: 'TECHNICIAN',
    })

    expect(prisma.user_family_access.updateMany).not.toHaveBeenCalled()
    expect(prisma.user_family_access.upsert).not.toHaveBeenCalled()
  })
})

describe('user-family-access lectura', () => {
  it('getUserModuleFamilyGrantIds lee solo user_family_access', async () => {
    ;(prisma.user_family_access.findMany as jest.Mock).mockResolvedValue([{ familyId: extraA }])

    const ids = await getUserModuleFamilyGrantIds('tech-1', 'tickets', 'canConsume')
    expect(ids).toEqual([extraA])
    expect(prisma.user_family_access.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'tech-1',
          module: 'tickets',
          isActive: true,
          canConsume: true,
        }),
      })
    )
  })

  it('getUserModuleFamilyGrantIds vacío si no hay grants', async () => {
    ;(prisma.user_family_access.findMany as jest.Mock).mockResolvedValue([])

    const ids = await getUserModuleFamilyGrantIds('tech-1', 'tickets', 'canConsume')
    expect(ids).toEqual([])
  })

  it('resolveModuleFamilyScopeIds incluye nativa', async () => {
    ;(prisma.user_family_access.findMany as jest.Mock).mockResolvedValue([{ familyId: extraA }])

    const ids = await resolveModuleFamilyScopeIds('tech-1', 'tickets', 'canConsume')
    expect(ids).toEqual(expect.arrayContaining([nativeFamily, extraA]))
  })

  it('userHasFamilyInModule true para nativa y grant', async () => {
    ;(prisma.user_family_access.findMany as jest.Mock).mockResolvedValue([{ familyId: extraA }])

    await expect(userHasFamilyInModule('tech-1', 'tickets', nativeFamily)).resolves.toBe(true)
    await expect(userHasFamilyInModule('tech-1', 'tickets', extraA)).resolves.toBe(true)
    await expect(userHasFamilyInModule('tech-1', 'tickets', 'fam-other')).resolves.toBe(false)
  })

  it('diagnoseUserFamilyAccessDrift reporta totales por módulo sin drifts legacy', async () => {
    ;(prisma.users.count as jest.Mock).mockResolvedValue(1)
    ;(prisma.user_family_access.count as jest.Mock).mockResolvedValue(2)

    const report = await diagnoseUserFamilyAccessDrift({ userId: 'tech-1' })
    expect(report.checked).toBe(1)
    expect(report.drifts).toEqual([])
    expect(report.totals.tickets).toBe(2)
  })
})
