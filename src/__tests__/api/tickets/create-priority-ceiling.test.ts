/**
 * POST /api/tickets — techo de prioridad automático por categoría.
 *
 * Antes, cualquier creador (sin importar su rol) podía elegir "Urgente" y
 * esa elección se usaba tal cual como prioridad operativa — sin ningún
 * control, cualquier cliente podía saltarse la cola marcando siempre
 * Urgente. Ahora, para un creador CLIENT, `resolveInitialPriority` topa la
 * prioridad operativa según `categories.priorityCeiling` (configurable una
 * sola vez por categoría, no por ticket); ADMIN/TECHNICIAN no tienen tope.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    categories: { findUnique: jest.fn() },
    users: { findUnique: jest.fn() },
    tickets: { count: jest.fn().mockResolvedValue(0), findUnique: jest.fn() },
    ticket_family_config: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}))

jest.mock('@/lib/services/ticket-service', () => ({
  TicketService: { createTicket: jest.fn() },
}))

jest.mock('@/lib/services/sla-service', () => ({
  SLAService: { assignSLA: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('@/lib/services/webhook-service', () => ({
  WebhookService: {
    trigger: jest.fn().mockResolvedValue(undefined),
    EVENTS: { TICKET_CREATED: 'ticket.created' },
  },
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditServiceComplete: { log: jest.fn().mockResolvedValue(undefined) },
  AuditActionsComplete: { TICKET_CREATED: 'x' },
}))

jest.mock('@/lib/services/notification-service', () => ({
  NotificationService: {
    notifyTicketCreated: jest.fn().mockResolvedValue(undefined),
    notifyTicketAssigned: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/lib/services/email/email-service', () => ({
  EmailService: { queueEmail: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('@/lib/settings/runtime-settings', () => ({
  getAutoAssignmentEnabled: jest.fn().mockResolvedValue(false),
  getMaxTicketsPerUser: jest.fn().mockResolvedValue(50),
}))

jest.mock('@/lib/tickets/notify-ticket-changed', () => ({
  notifyTicketChanged: jest.fn(),
}))

jest.mock('@/lib/services/file-service', () => ({
  FileService: { uploadBase64Attachment: jest.fn() },
}))

jest.mock('@/lib/email-triggers', () => ({
  triggerTicketCreatedToAdminEmail: jest.fn(),
  triggerTicketAssignedToTechnicianEmail: jest.fn(),
  triggerTicketAssignedToClientEmail: jest.fn(),
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { TicketService } from '@/lib/services/ticket-service'
import { POST } from '@/app/api/tickets/route'

function jsonReq(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

function mockCreatedTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    title: 'Algo urgente',
    description: 'desc',
    status: 'OPEN',
    priority: 'MEDIUM',
    assigneeId: null,
    clientId: 'client-1',
    categoryId: 'cat-1',
    createdAt: new Date(),
    ticketCode: 'TI-1',
    users_tickets_clientIdTousers: { id: 'client-1', name: 'Cliente', email: 'c@test.com' },
    users_tickets_assigneeIdTousers: null,
    categories: { id: 'cat-1', name: 'Solicitud de acceso' },
    ...overrides,
  }
}

describe('POST /api/tickets — techo de prioridad por categoría', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ id: 'client-1', isActive: true })
    ;(prisma.tickets.count as jest.Mock).mockResolvedValue(0)
    ;(TicketService.createTicket as jest.Mock).mockImplementation(async (data: any) =>
      mockCreatedTicket({ priority: data.priority })
    )
  })

  it('CLIENT pidiendo Urgente en una categoría con techo Media → se crea con prioridad Media, y queda registrado lo pedido', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT', isSuperAdmin: false },
    })
    ;(prisma.categories.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-1',
      familyId: null,
      priorityCeiling: 'MEDIUM',
      departments: null,
    })

    const res = await POST(
      jsonReq({
        title: 'Necesito acceso',
        description: 'desc',
        categoryId: 'cat-1',
        priority: 'URGENT',
      })
    )

    expect(res.status).toBe(200)
    expect(TicketService.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'MEDIUM', requestedPriority: 'URGENT' })
    )
  })

  it('CLIENT pidiendo Urgente en una categoría con techo Urgente → se respeta sin recorte', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT', isSuperAdmin: false },
    })
    ;(prisma.categories.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-1',
      familyId: null,
      priorityCeiling: 'URGENT',
      departments: null,
    })

    await POST(
      jsonReq({
        title: 'Fuga de agua',
        description: 'desc',
        categoryId: 'cat-1',
        priority: 'URGENT',
      })
    )

    expect(TicketService.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'URGENT', requestedPriority: undefined })
    )
  })

  it('ADMIN pidiendo Urgente → sin tope, sin importar el techo de la categoría', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.categories.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-1',
      familyId: null,
      priorityCeiling: 'LOW',
      departments: null,
    })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ id: 'admin-1', isActive: true })

    await POST(
      jsonReq({
        title: 'Algo urgente',
        description: 'desc',
        categoryId: 'cat-1',
        priority: 'URGENT',
      })
    )

    expect(TicketService.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'URGENT', requestedPriority: undefined })
    )
  })

  it('categoría sin techo configurado (null) → CLIENT queda topado en Media por defecto', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT', isSuperAdmin: false },
    })
    ;(prisma.categories.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-1',
      familyId: null,
      priorityCeiling: null,
      departments: null,
    })

    await POST(
      jsonReq({
        title: 'Necesito acceso',
        description: 'desc',
        categoryId: 'cat-1',
        priority: 'URGENT',
      })
    )

    expect(TicketService.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'MEDIUM', requestedPriority: 'URGENT' })
    )
  })

  it('categoría sin techo propio pero familia con techo Alto → se usa el techo de la familia', async () => {
    // isSuperAdmin:true evita el chequeo de scope de familia (irrelevante
    // para esta prueba, que solo verifica la resolución del techo).
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT', isSuperAdmin: true },
    })
    ;(prisma.categories.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-1',
      familyId: 'fam-1',
      priorityCeiling: null,
      departments: null,
    })
    ;(prisma.ticket_family_config.findUnique as jest.Mock).mockResolvedValue({
      ticketsEnabled: true,
      priorityCeiling: 'HIGH',
    })

    await POST(
      jsonReq({
        title: 'Necesito acceso',
        description: 'desc',
        categoryId: 'cat-1',
        priority: 'URGENT',
      })
    )

    expect(TicketService.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'HIGH', requestedPriority: 'URGENT' })
    )
  })

  it('categoría CON techo propio manda sobre el techo (más permisivo) de la familia', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT', isSuperAdmin: true },
    })
    ;(prisma.categories.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-1',
      familyId: 'fam-1',
      priorityCeiling: 'LOW',
      departments: null,
    })
    ;(prisma.ticket_family_config.findUnique as jest.Mock).mockResolvedValue({
      ticketsEnabled: true,
      priorityCeiling: 'URGENT',
    })

    await POST(
      jsonReq({
        title: 'Necesito acceso',
        description: 'desc',
        categoryId: 'cat-1',
        priority: 'URGENT',
      })
    )

    expect(TicketService.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'LOW', requestedPriority: 'URGENT' })
    )
  })
})
