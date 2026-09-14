/**
 * GET/DELETE /api/users/[id]/assignments
 *
 * Dos bugs reales:
 *
 * 1. GET no exigía nada más que estar autenticado — cualquier CLIENT podía
 *    pedir las estadísticas de carga/desempeño de CUALQUIER técnico o admin
 *    del sistema, sin scope de familia/departamento (contraste con `stats`/
 *    `tickets` del mismo recurso, que sí lo exigen).
 *
 * 2. DELETE validaba el scope sobre `id` (el técnico de la URL) pero
 *    mutaba una fila identificada por `assignmentId` de query string sin
 *    verificar que perteneciera a ese `id` — IDOR: un admin scopeado sobre
 *    el técnico A podía desactivar una asignación de un técnico B fuera de
 *    su ámbito con solo conocer su `assignmentId`.
 */

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn() },
    technician_assignments: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    tickets: {
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}))

jest.mock('@/lib/auth/admin-scope', () => ({
  assertAdminCanManageUser: jest.fn(),
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
import { assertAdminCanManageUser } from '@/lib/auth/admin-scope'
import { GET, DELETE } from '@/app/api/users/[id]/assignments/route'

const TECH_ID = 'tech-1'

function params(id = TECH_ID) {
  return { params: Promise.resolve({ id }) }
}

function getRequest() {
  return {} as any
}

function deleteRequest(assignmentId: string) {
  return {
    url: `https://app.test/api/users/${TECH_ID}/assignments?assignmentId=${assignmentId}`,
  } as any
}

describe('GET /api/users/[id]/assignments — scope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      id: TECH_ID,
      name: 'Tech',
      role: 'TECHNICIAN',
    })
  })

  it('regresión: un CLIENT no puede ver las asignaciones/estadísticas de un técnico ajeno', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT' },
    })

    const res = await GET(getRequest(), params())

    expect(res.status).toBe(403)
    expect(prisma.technician_assignments.findMany).not.toHaveBeenCalled()
  })

  it('un ADMIN fuera de scope recibe el error del scope-check', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(assertAdminCanManageUser as jest.Mock).mockResolvedValue({
      allowed: false,
      status: 403,
      error: 'No autorizado para gestionar este usuario',
    })

    const res = await GET(getRequest(), params())

    expect(res.status).toBe(403)
    expect(prisma.technician_assignments.findMany).not.toHaveBeenCalled()
  })

  it('el propio técnico puede ver sus asignaciones sin pasar por el scope-check de admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: TECH_ID, role: 'TECHNICIAN' },
    })

    const res = await GET(getRequest(), params())

    expect(res.status).toBe(200)
    expect(assertAdminCanManageUser).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/users/[id]/assignments — IDOR', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ isSuperAdmin: false })
    ;(assertAdminCanManageUser as jest.Mock).mockResolvedValue({ allowed: true })
  })

  it('regresión: el update queda scopeado a technicianId además del id de la asignación', async () => {
    ;(prisma.technician_assignments.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    await DELETE(deleteRequest('assign-of-other-tech'), params())

    expect(prisma.technician_assignments.updateMany).toHaveBeenCalledWith({
      where: { id: 'assign-of-other-tech', technicianId: TECH_ID },
      data: expect.objectContaining({ isActive: false }),
    })
  })

  it('si la asignación no pertenece a este técnico (count 0), responde 404 en vez de éxito silencioso', async () => {
    ;(prisma.technician_assignments.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await DELETE(deleteRequest('assign-of-other-tech'), params())
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
  })
})
