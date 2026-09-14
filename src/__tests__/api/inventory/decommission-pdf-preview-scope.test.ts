/**
 * GET /api/inventory/decommission-acts/[id]/pdf y .../preview
 *
 * Mismo bug que el detalle: el comentario de /pdf decía explícitamente
 * "Permisos: ADMIN (cualquiera)" — cualquier ADMIN no-super podía descargar/
 * previsualizar el acta de baja (con datos del equipo, motivo, dictamen) de
 * una familia que no administra, sin ningún chequeo de scope.
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
  canManageInventory: jest.fn().mockResolvedValue(false),
}))

jest.mock('@/lib/inventory/inventory-session', () => ({
  getInventorySessionContext: jest.fn(),
  resolveCanManageInventory: jest.fn().mockResolvedValue(false),
}))

jest.mock('fs/promises', () => ({ readFile: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')) }))
jest.mock('fs', () => ({ existsSync: jest.fn(() => true) }))
jest.mock('@/lib/upload-path', () => ({
  getUploadDir: (...segments: string[]) => ['/uploads', ...segments].join('/'),
}))

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number
    constructor(_body: unknown, init?: { status?: number }) {
      this.status = init?.status ?? 200
    }
    static json(data: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => data }
    }
  }
  return { NextResponse: MockNextResponse }
})

import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'
import { GET as pdfGET } from '@/app/api/inventory/decommission-acts/[id]/pdf/route'
import { GET as previewGET } from '@/app/api/inventory/decommission-acts/[id]/preview/route'

const OTHER_FAMILY = 'family-other'

function params() {
  return { params: Promise.resolve({ id: 'req-1' }) }
}

function approvedRequest() {
  return {
    status: 'APPROVED',
    requestedById: 'client-1',
    assetType: 'EQUIPMENT',
    equipment: { type: { familyId: OTHER_FAMILY } },
    license: null,
    act: { id: 'act-1', folio: 'BAJA-2026-00001', pdfPath: '/uploads/decommission-acts/x.pdf' },
    requester: { id: 'client-1' },
  }
}

describe.each([
  ['pdf', pdfGET],
  ['preview', previewGET],
])('GET /api/inventory/decommission-acts/[id]/%s — scope de familia', (_name, handler) => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.decommission_requests.findUnique as jest.Mock).mockResolvedValue(approvedRequest())
  })

  it('regresión: un ADMIN no-super fuera del ámbito de familia recibe 403, no descarga el PDF', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(getInventorySessionContext as jest.Mock).mockResolvedValue({
      scope: { noAccess: false, familyIds: ['family-mine'] },
    })

    const res = await handler({} as any, params())

    expect(res.status).toBe(403)
  })

  it('un ADMIN no-super DENTRO del ámbito puede descargar/previsualizar', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(getInventorySessionContext as jest.Mock).mockResolvedValue({
      scope: { noAccess: false, familyIds: [OTHER_FAMILY] },
    })

    const res = await handler({} as any, params())

    expect(res.status).toBe(200)
  })

  it('el solicitante original siempre puede acceder al suyo, sin scope', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT', isSuperAdmin: false },
    })

    const res = await handler({} as any, params())

    expect(res.status).toBe(200)
    expect(getInventorySessionContext).not.toHaveBeenCalled()
  })
})
