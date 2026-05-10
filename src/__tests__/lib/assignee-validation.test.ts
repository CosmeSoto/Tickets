import { assertTechnicianActiveInFamily } from '@/lib/tickets/assignee-validation'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    technician_family_assignments: {
      findFirst: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as any

describe('assertTechnicianActiveInFamily', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('no-op when assigneeId is missing', async () => {
    await assertTechnicianActiveInFamily(undefined, 'fam-1')
    expect(mockPrisma.technician_family_assignments.findFirst).not.toHaveBeenCalled()
  })

  it('no-op when familyId is missing', async () => {
    await assertTechnicianActiveInFamily('tech-1', undefined)
    expect(mockPrisma.technician_family_assignments.findFirst).not.toHaveBeenCalled()
  })

  it('throws when no active assignment', async () => {
    mockPrisma.technician_family_assignments.findFirst.mockResolvedValue(null)
    await expect(assertTechnicianActiveInFamily('tech-1', 'fam-1')).rejects.toThrow(
      'asignación activa'
    )
  })

  it('resolves when assignment exists', async () => {
    mockPrisma.technician_family_assignments.findFirst.mockResolvedValue({ id: 'a1' })
    await expect(assertTechnicianActiveInFamily('tech-1', 'fam-1')).resolves.toBeUndefined()
  })
})
