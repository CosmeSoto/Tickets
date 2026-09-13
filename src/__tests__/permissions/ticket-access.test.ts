/**
 * Tests de Permisos: ticket-access.ts
 *
 * Cubre 3 reglas descubiertas/corregidas en vivo durante esta sesión, que no
 * tenían ninguna protección automática contra regresión:
 *
 * 1. Un colaborador (técnico sumado al ticket sin ser el asignado) puede
 *    trabajar las TAREAS de un plan de resolución activo, pero no puede
 *    gestionar el PLAN en sí (crear/activar/completar/cancelar/eliminar) ni
 *    los colaboradores — eso sigue siendo exclusivo del asignado (o admin).
 * 2. Un técnico que no es ni el asignado ni colaborador no puede leer un
 *    ticket ya asignado a otra persona (solo ve la cola de sin asignar).
 */

jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    ticket_collaborators: { findUnique: jest.fn() },
  }
  return {
    prisma: prismaMock,
    __esModule: true,
    default: prismaMock,
  }
})

import prisma from '@/lib/prisma'
import {
  canAccessTicket,
  type TicketAccessRecord,
  type TicketAccessUser,
} from '@/lib/tickets/ticket-access'

const ASSIGNEE_ID = 'user-assignee'
const COLLABORATOR_ID = 'user-collaborator'
const OTHER_TECH_ID = 'user-other-tech'
const CLIENT_ID = 'user-client'

function ticket(overrides: Partial<TicketAccessRecord> = {}): TicketAccessRecord {
  return {
    id: 'ticket-1',
    clientId: CLIENT_ID,
    assigneeId: ASSIGNEE_ID,
    familyId: 'family-1',
    ...overrides,
  }
}

function technician(id: string): TicketAccessUser {
  return { id, role: 'TECHNICIAN' }
}

describe('ticket-access: colaboradores vs. asignado', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.ticket_collaborators.findUnique as jest.Mock).mockImplementation(
      async ({
        where,
      }: {
        where: { ticketId_collaboratorId: { ticketId: string; collaboratorId: string } }
      }) => {
        const { collaboratorId } = where.ticketId_collaboratorId
        return collaboratorId === COLLABORATOR_ID ? { ticketId: 'ticket-1' } : null
      }
    )
  })

  describe("action 'resolution_plan_tasks' (trabajar tareas)", () => {
    it('permite al técnico asignado', async () => {
      await expect(
        canAccessTicket(technician(ASSIGNEE_ID), ticket(), 'resolution_plan_tasks')
      ).resolves.toBe(true)
    })

    it('permite a un colaborador (no asignado)', async () => {
      await expect(
        canAccessTicket(technician(COLLABORATOR_ID), ticket(), 'resolution_plan_tasks')
      ).resolves.toBe(true)
    })

    it('rechaza a un técnico que no es ni asignado ni colaborador', async () => {
      await expect(
        canAccessTicket(technician(OTHER_TECH_ID), ticket(), 'resolution_plan_tasks')
      ).resolves.toBe(false)
    })
  })

  describe("action 'resolution_plan' (gestionar el plan en sí)", () => {
    it('permite al técnico asignado', async () => {
      await expect(
        canAccessTicket(technician(ASSIGNEE_ID), ticket(), 'resolution_plan')
      ).resolves.toBe(true)
    })

    it('rechaza a un colaborador — no puede crear/activar/completar/cancelar/eliminar el plan', async () => {
      await expect(
        canAccessTicket(technician(COLLABORATOR_ID), ticket(), 'resolution_plan')
      ).resolves.toBe(false)
    })
  })

  describe("action 'manage_collaborators'", () => {
    it('permite al técnico asignado', async () => {
      await expect(
        canAccessTicket(technician(ASSIGNEE_ID), ticket(), 'manage_collaborators')
      ).resolves.toBe(true)
    })

    it('rechaza a un colaborador — no puede sumar/quitar otros colaboradores', async () => {
      await expect(
        canAccessTicket(technician(COLLABORATOR_ID), ticket(), 'manage_collaborators')
      ).resolves.toBe(false)
    })
  })

  describe("action 'read' — técnico ajeno a un ticket ya asignado", () => {
    it('rechaza a un técnico que no es ni asignado ni colaborador (sin llegar a la cola de sin asignar)', async () => {
      await expect(canAccessTicket(technician(OTHER_TECH_ID), ticket(), 'read')).resolves.toBe(
        false
      )
    })

    it('permite al colaborador leer el ticket', async () => {
      await expect(canAccessTicket(technician(COLLABORATOR_ID), ticket(), 'read')).resolves.toBe(
        true
      )
    })
  })
})
