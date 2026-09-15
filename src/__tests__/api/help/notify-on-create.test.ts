/**
 * POST /api/help/bug-report, POST /api/help/contact
 *
 * Ambas rutas crean el ticket con `prisma.tickets.create` directo (no vía
 * /api/tickets), así que NO disparaban ninguna notificación pese a que el
 * comentario del código decía "el sistema de notificaciones automáticamente
 * detectará este ticket" — no existe tal detección automática, solo
 * /api/tickets llama explícitamente a `notifyTicketCreated`. El reporte/
 * consulta se creaba en absoluto silencio: nadie se enteraba. Por la misma
 * razón (no pasan por /api/tickets) tampoco llamaban a
 * `SLAService.assignSLA`, así que nunca tenían `slaDeadline`; y tampoco
 * aplicaban el techo de prioridad por categoría (`priorityCeiling`).
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/services/notification-service', () => ({
  NotificationService: { notifyTicketCreated: jest.fn().mockResolvedValue([]) },
}))

jest.mock('@/lib/services/sla-service', () => ({
  SLAService: { assignSLA: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    categories: { findFirst: jest.fn(), create: jest.fn() },
    tickets: { create: jest.fn() },
  },
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
import { NotificationService } from '@/lib/services/notification-service'
import { SLAService } from '@/lib/services/sla-service'
import { POST as bugReportPOST } from '@/app/api/help/bug-report/route'
import { POST as contactPOST } from '@/app/api/help/contact/route'

function jsonReq(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

describe('POST /api/help/bug-report — notifica al crear', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'client-1', role: 'CLIENT' } })
    ;(prisma.categories.findFirst as jest.Mock).mockResolvedValue({ id: 'cat-bugs' })
    ;(prisma.tickets.create as jest.Mock).mockResolvedValue({ id: 'ticket-1' })
  })

  it('regresión: crea el ticket y llama a NotificationService.notifyTicketCreated con su id', async () => {
    const res = await bugReportPOST(
      jsonReq({
        title: 'Error al guardar',
        severity: 'HIGH',
        steps: 'Pasos',
        expected: 'Esperado',
        actual: 'Actual',
      })
    )

    expect(res.status).toBe(200)
    expect(NotificationService.notifyTicketCreated).toHaveBeenCalledWith('ticket-1')
  })

  it('un fallo en la notificación no rompe la respuesta al usuario', async () => {
    ;(NotificationService.notifyTicketCreated as jest.Mock).mockRejectedValue(new Error('boom'))

    const res = await bugReportPOST(
      jsonReq({
        title: 'Error al guardar',
        severity: 'HIGH',
        steps: 'Pasos',
        expected: 'Esperado',
        actual: 'Actual',
      })
    )

    expect(res.status).toBe(200)
  })

  it('regresión: también asigna SLA (antes nunca lo hacía, al no pasar por /api/tickets)', async () => {
    await bugReportPOST(
      jsonReq({
        title: 'Error al guardar',
        severity: 'HIGH',
        steps: 'Pasos',
        expected: 'Esperado',
        actual: 'Actual',
      })
    )

    expect(SLAService.assignSLA).toHaveBeenCalledWith('ticket-1')
  })

  it('CRITICAL (→ URGENT) en una categoría de bugs con techo Alto → se crea con prioridad Alta, no Urgente', async () => {
    ;(prisma.categories.findFirst as jest.Mock).mockResolvedValue({
      id: 'cat-bugs',
      priorityCeiling: 'HIGH',
    })

    await bugReportPOST(
      jsonReq({
        title: 'Se cayó el sistema',
        severity: 'CRITICAL',
        steps: 'Pasos',
        expected: 'Esperado',
        actual: 'Actual',
      })
    )

    expect(prisma.tickets.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: 'HIGH', requestedPriority: 'URGENT' }),
      })
    )
  })
})

describe('POST /api/help/contact — notifica al crear', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'client-1', role: 'CLIENT' } })
    ;(prisma.categories.findFirst as jest.Mock).mockResolvedValue({ id: 'cat-support' })
    ;(prisma.tickets.create as jest.Mock).mockResolvedValue({ id: 'ticket-2' })
  })

  it('regresión: crea el ticket y llama a NotificationService.notifyTicketCreated con su id', async () => {
    const res = await contactPOST(
      jsonReq({
        subject: 'No puedo entrar',
        category: 'technical',
        priority: 'medium',
        message: 'Ayuda',
      })
    )

    expect(res.status).toBe(200)
    expect(NotificationService.notifyTicketCreated).toHaveBeenCalledWith('ticket-2')
  })

  it('regresión: también asigna SLA (antes nunca lo hacía, al no pasar por /api/tickets)', async () => {
    await contactPOST(
      jsonReq({
        subject: 'No puedo entrar',
        category: 'technical',
        priority: 'medium',
        message: 'Ayuda',
      })
    )

    expect(SLAService.assignSLA).toHaveBeenCalledWith('ticket-2')
  })

  it('pidiendo Urgente en una categoría con techo Media → se crea con prioridad Media', async () => {
    ;(prisma.categories.findFirst as jest.Mock).mockResolvedValue({
      id: 'cat-support',
      priorityCeiling: 'MEDIUM',
    })

    await contactPOST(
      jsonReq({
        subject: 'No puedo entrar',
        category: 'technical',
        priority: 'urgent',
        message: 'Ayuda',
      })
    )

    expect(prisma.tickets.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: 'MEDIUM', requestedPriority: 'URGENT' }),
      })
    )
  })

  it('prioridad con un valor que no es del enum → 400, no se crea el ticket', async () => {
    const res = await contactPOST(
      jsonReq({
        subject: 'No puedo entrar',
        category: 'technical',
        priority: 'lo-antes-posible',
        message: 'Ayuda',
      })
    )

    expect(res.status).toBe(400)
    expect(prisma.tickets.create).not.toHaveBeenCalled()
  })
})
