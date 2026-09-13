/**
 * PatrolIncidentService — regresión de concurrencia
 *
 * resolve/escalateToTicket/update/delete seguían el patrón inseguro
 * findUnique → chequear status en JS → update/delete incondicional, sin
 * transacción ni condición atómica. Dos llamadas casi simultáneas sobre el
 * mismo incidente OPEN (doble-click, reintento de red, dos admins actuando a
 * la vez) podían ambas pasar el chequeo y ambas ejecutar la acción —
 * en escalateToTicket esto creaba dos tickets reales a partir de una sola
 * novedad. La corrección usa updateMany/deleteMany con `where: { status: 'OPEN' }`
 * como "claim" atómico: solo una de las llamadas concurrentes puede ganarlo
 * (count > 0), y la otra ve count === 0 y aborta con un error claro.
 *
 * Estos tests simulan la pérdida de esa carrera mockeando `count: 0` en el
 * updateMany/deleteMany de claim — equivalente a lo que pasaría si otra
 * request ya hubiera ganado la carrera en la base de datos real.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    patrol_incidents: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    patrol_family_config: { findUnique: jest.fn() },
    categories: { findFirst: jest.fn() },
    patrol_photos: { update: jest.fn() },
  },
}))

jest.mock('@/lib/services/ticket-service', () => ({
  TicketService: { createTicket: jest.fn() },
}))

jest.mock('@/lib/services/notification-service', () => ({
  NotificationService: {
    push: jest.fn().mockResolvedValue(undefined),
    notifyTicketCreated: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditServiceComplete: { log: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('@/lib/services/patrol-photo.service', () => ({
  PatrolPhotoService: { savePhoto: jest.fn() },
}))

jest.mock('@/lib/services/file-service', () => ({
  FileService: { uploadBase64Attachment: jest.fn() },
}))

jest.mock('@/lib/patrol/patrol-helpers', () => ({
  getPatrolSupervisors: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/auth/family-scope', () => ({
  resolveValidFamilyId: jest.fn(async (id: string) => id),
}))

import prisma from '@/lib/prisma'
import { TicketService } from '@/lib/services/ticket-service'
import { PatrolIncidentService } from '../patrol-incident.service'

const INCIDENT_ID = 'incident-1'
const AGENT_ID = 'agent-1'
const ADMIN_ID = 'admin-1'

function baseIncidentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: INCIDENT_ID,
    patrolId: 'patrol-1',
    checkpointId: 'cp-1',
    agentId: AGENT_ID,
    description: 'Puerta forzada',
    severity: 'HIGH',
    status: 'OPEN',
    photoIds: [],
    ticketId: null,
    createdAt: new Date(),
    patrol: { id: 'patrol-1', familyId: 'family-1' },
    checkpoint: { name: 'Entrada principal' },
    photos: [],
    ...overrides,
  }
}

describe('PatrolIncidentService — guards atómicos contra condiciones de carrera', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('escalateToTicket', () => {
    it('aborta sin crear el ticket si el claim (updateMany OPEN→ESCALATED) ya fue ganado por otro proceso', async () => {
      ;(prisma.patrol_incidents.findUnique as jest.Mock).mockResolvedValue(baseIncidentRow())
      ;(prisma.patrol_incidents.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

      await expect(PatrolIncidentService.escalateToTicket(INCIDENT_ID, ADMIN_ID)).rejects.toThrow(
        /ya fue resuelta o escalada/i
      )

      expect(TicketService.createTicket).not.toHaveBeenCalled()
    })

    it('camino feliz: reclama, crea el ticket y lo vincula', async () => {
      ;(prisma.patrol_incidents.findUnique as jest.Mock).mockResolvedValue(baseIncidentRow())
      ;(prisma.patrol_incidents.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prisma.patrol_family_config.findUnique as jest.Mock).mockResolvedValue({
        patrolIncidentCategoryId: 'cat-1',
      })
      ;(TicketService.createTicket as jest.Mock).mockResolvedValue({
        id: 'ticket-1',
        ticketCode: 'ADM-0001',
      })
      ;(prisma.patrol_incidents.update as jest.Mock).mockResolvedValue(
        baseIncidentRow({ status: 'ESCALATED', ticketId: 'ticket-1' })
      )

      const result = await PatrolIncidentService.escalateToTicket(INCIDENT_ID, ADMIN_ID)

      expect(result.ticketId).toBe('ticket-1')
      expect(TicketService.createTicket).toHaveBeenCalledTimes(1)
      expect(TicketService.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: AGENT_ID, source: 'PATROL' })
      )
      // Vincula el ticket sin volver a condicionar por status — el claim ya
      // hizo esta instancia la única dueña del incidente.
      expect(prisma.patrol_incidents.update).toHaveBeenCalledWith({
        where: { id: INCIDENT_ID },
        data: { ticketId: 'ticket-1' },
      })
    })

    it('revierte el claim a OPEN si falla la creación del ticket después de reclamar', async () => {
      ;(prisma.patrol_incidents.findUnique as jest.Mock).mockResolvedValue(baseIncidentRow())
      ;(prisma.patrol_incidents.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prisma.patrol_family_config.findUnique as jest.Mock).mockResolvedValue({
        patrolIncidentCategoryId: 'cat-1',
      })
      ;(TicketService.createTicket as jest.Mock).mockRejectedValue(new Error('DB caída'))
      ;(prisma.patrol_incidents.update as jest.Mock).mockResolvedValue({})

      await expect(PatrolIncidentService.escalateToTicket(INCIDENT_ID, ADMIN_ID)).rejects.toThrow(
        'DB caída'
      )

      // No debe quedar trabado en ESCALATED sin ticket — se revierte a OPEN.
      expect(prisma.patrol_incidents.update).toHaveBeenCalledWith({
        where: { id: INCIDENT_ID },
        data: { status: 'OPEN', resolvedAt: null, resolvedById: null },
      })
    })
  })

  describe('resolve', () => {
    it('aborta si el claim (updateMany OPEN→RESOLVED) ya fue ganado por otro proceso', async () => {
      ;(prisma.patrol_incidents.findUnique as jest.Mock).mockResolvedValue(baseIncidentRow())
      ;(prisma.patrol_incidents.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

      await expect(PatrolIncidentService.resolve(INCIDENT_ID, ADMIN_ID)).rejects.toThrow(
        /ya fue resuelta o escalada/i
      )
    })

    it('camino feliz: reclama y marca RESOLVED', async () => {
      ;(prisma.patrol_incidents.findUnique as jest.Mock)
        .mockResolvedValueOnce(baseIncidentRow())
        .mockResolvedValueOnce(baseIncidentRow({ status: 'RESOLVED' }))
      ;(prisma.patrol_incidents.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

      const result = await PatrolIncidentService.resolve(INCIDENT_ID, ADMIN_ID)

      expect(result?.status).toBe('RESOLVED')
      expect(prisma.patrol_incidents.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: INCIDENT_ID, status: 'OPEN' } })
      )
    })
  })

  describe('update', () => {
    it('rechaza editar si el incidente ya no está OPEN al momento de escribir (updateMany count 0)', async () => {
      ;(prisma.patrol_incidents.findUnique as jest.Mock).mockResolvedValue(baseIncidentRow())
      ;(prisma.patrol_incidents.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

      await expect(
        PatrolIncidentService.update(INCIDENT_ID, { description: 'Editado' }, AGENT_ID)
      ).rejects.toThrow(/ya fue resuelta o escalada/i)
    })
  })

  describe('delete', () => {
    it('rechaza eliminar si el incidente ya no está OPEN al momento de escribir (deleteMany count 0)', async () => {
      ;(prisma.patrol_incidents.findUnique as jest.Mock).mockResolvedValue(baseIncidentRow())
      ;(prisma.patrol_incidents.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })

      await expect(PatrolIncidentService.delete(INCIDENT_ID, AGENT_ID)).rejects.toThrow(
        /ya fue resuelta o escalada/i
      )
    })
  })
})
