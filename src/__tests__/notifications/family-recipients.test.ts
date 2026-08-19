import {
  getFamilyScopedAdmins,
  getFamilyScopedAdminsForFamilies,
  getNativeFamilyAdmins,
  getSuperAdmins,
  getTicketFamilyAdmins,
  getTicketOversightAdmins,
  excludeRecipients,
} from '@/lib/notifications/family-recipients'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: {
      findMany: jest.fn(),
    },
  },
}))

import prisma from '@/lib/prisma'

const mockFindMany = prisma.users.findMany as jest.Mock

describe('family-recipients', () => {
  beforeEach(() => {
    mockFindMany.mockReset()
  })

  it('getFamilyScopedAdmins incluye super admins y admin nativo de la familia', async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: 'super-1' }])
      .mockResolvedValueOnce([{ id: 'native-admin-1' }])

    const recipients = await getFamilyScopedAdmins('family-ti')

    expect(recipients).toEqual([{ id: 'super-1' }, { id: 'native-admin-1' }])
    expect(mockFindMany).toHaveBeenNthCalledWith(1, {
      where: { role: 'ADMIN', isSuperAdmin: true, isActive: true },
      select: { id: true },
    })
    expect(mockFindMany).toHaveBeenNthCalledWith(2, {
      where: {
        role: 'ADMIN',
        isSuperAdmin: false,
        isActive: true,
        departments: { familyId: 'family-ti', isActive: true },
      },
      select: { id: true },
    })
  })

  it('getFamilyScopedAdmins sin familyId solo retorna super admins', async () => {
    mockFindMany.mockResolvedValueOnce([{ id: 'super-1' }, { id: 'super-2' }])

    const recipients = await getFamilyScopedAdmins(null)

    expect(recipients).toHaveLength(2)
    expect(mockFindMany).toHaveBeenCalledTimes(1)
  })

  it('getFamilyScopedAdminsForFamilies deduplica admins de varias familias', async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: 'super-1' }])
      .mockResolvedValueOnce([{ id: 'admin-a' }])
      .mockResolvedValueOnce([{ id: 'admin-a' }, { id: 'admin-b' }])

    const recipients = await getFamilyScopedAdminsForFamilies(['fam-a', 'fam-b'])

    expect(recipients).toEqual([{ id: 'super-1' }, { id: 'admin-a' }, { id: 'admin-b' }])
  })

  it('getTicketFamilyAdmins une nativa y asignada sin super admins', async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: 'native-1' }])
      .mockResolvedValueOnce([{ id: 'assigned-1' }, { id: 'native-1' }])

    const recipients = await getTicketFamilyAdmins('family-ti')

    expect(recipients).toEqual([{ id: 'native-1' }, { id: 'assigned-1' }])
    expect(mockFindMany).toHaveBeenNthCalledWith(2, {
      where: {
        role: 'ADMIN',
        isSuperAdmin: false,
        isActive: true,
        userFamilyAccess: {
          some: { familyId: 'family-ti', module: 'tickets', isActive: true },
        },
      },
      select: { id: true },
    })
  })

  it('getTicketOversightAdmins incluye super admins y excluye involucrados', async () => {
    mockFindMany
      .mockResolvedValueOnce([{ id: 'super-1' }, { id: 'super-actor' }])
      .mockResolvedValueOnce([{ id: 'native-1' }])
      .mockResolvedValueOnce([{ id: 'assigned-1' }])

    const recipients = await getTicketOversightAdmins('family-ti', {
      excludeUserIds: ['super-actor', 'native-1', null],
    })

    expect(recipients.map(r => r.id)).toEqual(['super-1', 'assigned-1'])
  })

  it('excludeRecipients omite ids vacíos', () => {
    expect(excludeRecipients([{ id: 'a' }, { id: 'b' }], ['a', undefined, ''])).toEqual([
      { id: 'b' },
    ])
  })
})

describe('dedupeById (via exports)', () => {
  it('getSuperAdmins y getNativeFamilyAdmins son funciones exportadas', () => {
    expect(typeof getSuperAdmins).toBe('function')
    expect(typeof getNativeFamilyAdmins).toBe('function')
    expect(typeof getFamilyScopedAdmins).toBe('function')
  })
})
