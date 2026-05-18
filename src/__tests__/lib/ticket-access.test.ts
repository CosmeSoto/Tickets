import {
  canAccessTicket,
  type TicketAccessRecord,
  type TicketAccessUser,
} from '@/lib/tickets/ticket-access'
import { getUserFamilyScope } from '@/lib/auth/admin-scope'
import prisma from '@/lib/prisma'

jest.mock('@/lib/auth/admin-scope', () => ({
  getUserFamilyScope: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    ticket_collaborators: { findUnique: jest.fn() },
    technician_family_assignments: { findMany: jest.fn() },
  },
}))

const mockScope = getUserFamilyScope as jest.MockedFunction<typeof getUserFamilyScope>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

const baseTicket: TicketAccessRecord = {
  id: 'ticket-1',
  clientId: 'client-1',
  assigneeId: 'tech-1',
  familyId: 'fam-a',
}

function user(
  overrides: Partial<TicketAccessUser> & Pick<TicketAccessUser, 'id' | 'role'>
): TicketAccessUser {
  return {
    id: overrides.id,
    role: overrides.role,
    isSuperAdmin: overrides.isSuperAdmin ?? false,
  }
}

describe('ticket-access (permisos por ticket)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.ticket_collaborators.findUnique.mockResolvedValue(null)
    mockPrisma.technician_family_assignments.findMany.mockResolvedValue([])
  })

  describe('read', () => {
    it('permite al cliente dueño del ticket', async () => {
      const ok = await canAccessTicket(user({ id: 'client-1', role: 'CLIENT' }), baseTicket, 'read')
      expect(ok).toBe(true)
    })

    it('deniega a otro cliente', async () => {
      const ok = await canAccessTicket(user({ id: 'client-2', role: 'CLIENT' }), baseTicket, 'read')
      expect(ok).toBe(false)
    })

    it('permite al técnico asignado', async () => {
      const ok = await canAccessTicket(
        user({ id: 'tech-1', role: 'TECHNICIAN' }),
        baseTicket,
        'read'
      )
      expect(ok).toBe(true)
    })

    it('permite al colaborador aunque no sea asignado', async () => {
      mockPrisma.ticket_collaborators.findUnique.mockResolvedValue({ ticketId: 'ticket-1' } as any)
      const ok = await canAccessTicket(
        user({ id: 'tech-2', role: 'TECHNICIAN' }),
        baseTicket,
        'read'
      )
      expect(ok).toBe(true)
    })

    it('permite admin normal en familia asignada', async () => {
      mockScope.mockResolvedValue({
        familyIds: ['fam-a'],
        nativeFamilyId: null,
        isSuperAdmin: false,
        role: 'ADMIN',
      })
      const ok = await canAccessTicket(user({ id: 'admin-1', role: 'ADMIN' }), baseTicket, 'read')
      expect(ok).toBe(true)
    })

    it('deniega admin normal fuera de familia', async () => {
      mockScope.mockResolvedValue({
        familyIds: ['fam-b'],
        nativeFamilyId: null,
        isSuperAdmin: false,
        role: 'ADMIN',
      })
      const ok = await canAccessTicket(user({ id: 'admin-1', role: 'ADMIN' }), baseTicket, 'read')
      expect(ok).toBe(false)
    })

    it('permite super admin sin restricción', async () => {
      const ok = await canAccessTicket(
        user({ id: 'sa-1', role: 'ADMIN', isSuperAdmin: true }),
        baseTicket,
        'read'
      )
      expect(ok).toBe(true)
      expect(mockScope).not.toHaveBeenCalled()
    })
  })

  describe('assign', () => {
    it('solo admin puede asignar', async () => {
      mockScope.mockResolvedValue({
        familyIds: ['fam-a'],
        nativeFamilyId: null,
        isSuperAdmin: false,
        role: 'ADMIN',
      })
      expect(
        await canAccessTicket(user({ id: 'admin-1', role: 'ADMIN' }), baseTicket, 'assign')
      ).toBe(true)
      expect(
        await canAccessTicket(user({ id: 'tech-1', role: 'TECHNICIAN' }), baseTicket, 'assign')
      ).toBe(false)
    })
  })

  describe('resolution_plan', () => {
    it('permite técnico asignado', async () => {
      expect(
        await canAccessTicket(
          user({ id: 'tech-1', role: 'TECHNICIAN' }),
          baseTicket,
          'resolution_plan'
        )
      ).toBe(true)
    })

    it('deniega colaborador no asignado', async () => {
      mockPrisma.ticket_collaborators.findUnique.mockResolvedValue({ ticketId: 'ticket-1' } as any)
      expect(
        await canAccessTicket(
          user({ id: 'tech-2', role: 'TECHNICIAN' }),
          baseTicket,
          'resolution_plan'
        )
      ).toBe(false)
    })

    it('permite admin en scope de familia', async () => {
      mockScope.mockResolvedValue({
        familyIds: ['fam-a'],
        nativeFamilyId: null,
        isSuperAdmin: false,
        role: 'ADMIN',
      })
      expect(
        await canAccessTicket(user({ id: 'admin-1', role: 'ADMIN' }), baseTicket, 'resolution_plan')
      ).toBe(true)
    })
  })
})
