import { assertTechnicianActiveInFamily } from '@/lib/tickets/assignee-validation'
import prisma from '@/lib/prisma'
import { technicianIsNativeToFamily } from '@/lib/auth/family-scope'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/auth/family-scope', () => ({
  technicianIsNativeToFamily: jest.fn(),
}))

const mockFindUnique = prisma.users.findUnique as jest.Mock
const mockTechnicianIsNative = technicianIsNativeToFamily as jest.Mock

describe('assertTechnicianActiveInFamily', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindUnique.mockResolvedValue({ role: 'TECHNICIAN' })
    mockTechnicianIsNative.mockResolvedValue(true)
  })

  it('no-op when assigneeId is missing', async () => {
    await assertTechnicianActiveInFamily(undefined, 'fam-1')
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockTechnicianIsNative).not.toHaveBeenCalled()
  })

  it('no-op when familyId is missing', async () => {
    await assertTechnicianActiveInFamily('tech-1', undefined)
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockTechnicianIsNative).not.toHaveBeenCalled()
  })

  it('no-op when assignee is ADMIN', async () => {
    mockFindUnique.mockResolvedValue({ role: 'ADMIN' })

    await assertTechnicianActiveInFamily('admin-1', 'fam-1')

    expect(mockTechnicianIsNative).not.toHaveBeenCalled()
  })

  it('throws when technician is not native to family', async () => {
    mockTechnicianIsNative.mockResolvedValue(false)

    await expect(assertTechnicianActiveInFamily('tech-1', 'fam-1')).rejects.toThrow(/nativamente/)
  })

  it('resolves when technician is native to family', async () => {
    mockTechnicianIsNative.mockResolvedValue(true)

    await expect(assertTechnicianActiveInFamily('tech-1', 'fam-1')).resolves.toBeUndefined()
    expect(mockTechnicianIsNative).toHaveBeenCalledWith('tech-1', 'fam-1')
  })
})
