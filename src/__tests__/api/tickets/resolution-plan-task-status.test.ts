/**
 * PATCH /api/tickets/[id]/resolution-plan/tasks/[taskId]
 *
 * Regresión: una tarea no debía poder completarse (ni cambiar de estado en
 * general) mientras el plan sigue en "borrador" — se podía hasta que se
 * corrigió en vivo esta sesión. El checkbox de la UI ya lo bloquea
 * (task-list.tsx), esto cubre la validación real del servidor, que es la que
 * de verdad protege el dato (la UI se puede saltar con un fetch directo).
 */

import { getServerSession } from 'next-auth'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    resolution_tasks: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    resolution_plans: { update: jest.fn() },
    ticket_history: { create: jest.fn() },
  },
}))

jest.mock('@/lib/audit', () => ({
  auditTaskChange: jest.fn(),
}))

jest.mock('@/lib/tickets/notify-ticket-changed', () => ({
  notifyTicketChanged: jest.fn(),
}))

jest.mock('@/lib/services/resolution-notification-service', () => ({
  ResolutionNotificationService: { notifyTaskAssigned: jest.fn() },
}))

jest.mock('@/lib/tickets/ticket-access', () => {
  const actual = jest.requireActual('@/lib/tickets/ticket-access')
  return {
    ...actual,
    assertTicketAccess: jest.fn().mockResolvedValue(undefined),
  }
})

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
  NextRequest: class {},
}))

import prisma from '@/lib/prisma'
import { PATCH } from '@/app/api/tickets/[id]/resolution-plan/tasks/[taskId]/route'

const TICKET_ID = 'ticket-1'
const TASK_ID = 'task-1'

function makeRequest(body: unknown) {
  return { json: async () => body } as any
}

function makeTask(planStatus: string) {
  return {
    id: TASK_ID,
    planId: 'plan-1',
    title: 'Tarea de prueba',
    description: null,
    status: 'pending',
    priority: 'medium',
    assignedTo: null,
    plan: {
      id: 'plan-1',
      title: 'Plan de prueba',
      status: planStatus,
      ticketId: TICKET_ID,
      ticket: { id: TICKET_ID, clientId: 'client-1', assigneeId: 'tech-1', familyId: 'family-1' },
    },
  }
}

describe('PATCH resolution-plan task — bloqueo por plan en borrador', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'tech-1', role: 'TECHNICIAN' },
    })
  })

  it('rechaza completar una tarea si el plan sigue en borrador (400)', async () => {
    ;(prisma.resolution_tasks.findUnique as jest.Mock).mockResolvedValue(makeTask('draft'))

    const res = await PATCH(makeRequest({ status: 'completed' }), {
      params: Promise.resolve({ id: TICKET_ID, taskId: TASK_ID }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toMatch(/borrador/i)
    // No debió llegar a tocar la tarea
    expect(prisma.resolution_tasks.update).not.toHaveBeenCalled()
  })

  it('permite completar una tarea cuando el plan está activo', async () => {
    ;(prisma.resolution_tasks.findUnique as jest.Mock).mockResolvedValue(makeTask('active'))
    ;(prisma.resolution_tasks.update as jest.Mock).mockResolvedValue({
      id: TASK_ID,
      title: 'Tarea de prueba',
      description: null,
      status: 'completed',
      priority: 'medium',
      estimatedHours: null,
      actualHours: null,
      startTime: null,
      endTime: null,
      dueDate: null,
      completedAt: new Date(),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignee: null,
    })
    ;(prisma.resolution_tasks.findMany as jest.Mock).mockResolvedValue([
      { id: TASK_ID, status: 'pending' },
    ])

    const res = await PATCH(makeRequest({ status: 'completed' }), {
      params: Promise.resolve({ id: TICKET_ID, taskId: TASK_ID }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(prisma.resolution_tasks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) })
    )
  })

  it('permite editar campos que no son status aunque el plan esté en borrador', async () => {
    ;(prisma.resolution_tasks.findUnique as jest.Mock).mockResolvedValue(makeTask('draft'))
    ;(prisma.resolution_tasks.update as jest.Mock).mockResolvedValue({
      id: TASK_ID,
      title: 'Nuevo título',
      description: null,
      status: 'pending',
      priority: 'medium',
      estimatedHours: null,
      actualHours: null,
      startTime: null,
      endTime: null,
      dueDate: null,
      completedAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignee: null,
    })

    const res = await PATCH(makeRequest({ title: 'Nuevo título' }), {
      params: Promise.resolve({ id: TICKET_ID, taskId: TASK_ID }),
    })

    expect(res.status).toBe(200)
    // No debe llamarse resolution_tasks.findMany (esa rama solo corre si cambió el status)
    expect(prisma.resolution_tasks.findMany).not.toHaveBeenCalled()
  })
})
