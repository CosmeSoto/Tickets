/**
 * GET /api/inventory/decommission-acts/[id]
 *
 * Bug real: `isAdmin` (role === 'ADMIN', no necesariamente super admin)
 * bypasseaba por completo el chequeo de scope de familia — el listado
 * (`GET /api/inventory/decommission-acts`) y las rutas de escritura sobre
 * este mismo recurso (approve/reject/elevate, vía `isAdminOfFamily`) sí
 * exigen que un ADMIN no-super esté dentro de su ámbito; el detalle no.
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
    decommission_requests: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/inventory-access', () => ({
  canManageInventory: jest.fn(),
}))

jest.mock('@/lib/inventory/inventory-session', () => ({
  getInventorySessionContext: jest.fn(),
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
import { canManageInventory } from '@/lib/inventory-access'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'
import { GET } from '@/app/api/inventory/decommission-acts/[id]/route'

const REQUEST_ID = 'req-1'
const OTHER_FAMILY = 'family-other'

function params() {
  return { params: Promise.resolve({ id: REQUEST_ID }) }
}

function baseRequest() {
  return {
    id: REQUEST_ID,
    status: 'MANAGER_REVIEW',
    requestedById: 'client-1',
    assetType: 'EQUIPMENT',
    equipment: { type: { familyId: OTHER_FAMILY } },
    license: null,
    attachments: [],
  }
}

describe('GET /api/inventory/decommission-acts/[id] — scope de familia', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.decommission_requests.findUnique as jest.Mock).mockResolvedValue(baseRequest())
  })

  it('regresión: un ADMIN no-super fuera del ámbito de familia del activo recibe 403', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(canManageInventory as jest.Mock).mockResolvedValue(false)
    ;(getInventorySessionContext as jest.Mock).mockResolvedValue({
      scope: { noAccess: false, familyIds: ['family-mine'] },
    })

    const res = await GET({} as any, params())

    expect(res.status).toBe(403)
  })

  it('un ADMIN no-super DENTRO del ámbito de familia del activo puede verla', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(canManageInventory as jest.Mock).mockResolvedValue(false)
    ;(getInventorySessionContext as jest.Mock).mockResolvedValue({
      scope: { noAccess: false, familyIds: [OTHER_FAMILY] },
    })

    const res = await GET({} as any, params())

    expect(res.status).toBe(200)
  })

  it('el Super Admin siempre puede ver el detalle, sin scope', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'super-1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(canManageInventory as jest.Mock).mockResolvedValue(true)

    const res = await GET({} as any, params())

    expect(res.status).toBe(200)
    expect(getInventorySessionContext).not.toHaveBeenCalled()
  })

  it('el solicitante original puede ver su propia solicitud sin ser admin/gestor', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT', isSuperAdmin: false },
    })
    ;(canManageInventory as jest.Mock).mockResolvedValue(false)

    const res = await GET({} as any, params())

    expect(res.status).toBe(200)
  })
})
