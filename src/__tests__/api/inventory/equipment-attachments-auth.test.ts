/**
 * GET/DELETE /api/inventory/equipment/[id]/attachments/[attachmentId]
 *
 * Bug real: el GET no tenía NINGÚN chequeo de sesión/scope — cualquiera,
 * autenticado o no, podía descargar/previsualizar cualquier adjunto de
 * cualquier equipo de cualquier familia con solo conocer el `attachmentId`.
 * Combinado con `Content-Type` servido tal cual desde BD (sin allowlist) y
 * `?preview=true` -> `inline`, esto también habilitaba XSS almacenada para
 * un adjunto legado con mimeType peligroso.
 *
 * El DELETE ya exigía `canManageInventory`, pero ese permiso es GLOBAL (no
 * por familia) — se refuerza con el scope real de familia del equipo.
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
    equipment_attachments: { findFirst: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
    // Sin fila -> CloudStorageService.getActiveProvider() resuelve a 'local'.
    system_settings: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}))

jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('file-bytes')),
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
}))

jest.mock('@/lib/inventory/inventory-resource-access', () => ({
  assertInventoryResourceRead: jest.fn(),
  assertInventoryResourceManage: jest.fn(),
  InventoryAccessError: class InventoryAccessError extends Error {
    statusCode: number
    constructor(message: string, statusCode = 403) {
      super(message)
      this.statusCode = statusCode
    }
  },
  inventoryAccessToResponse: (err: { message: string; statusCode: number }) => ({
    status: err.statusCode,
    json: async () => ({ error: err.message }),
  }),
  toInventoryAccessUser: (u: { id: string; role: string; isSuperAdmin?: boolean }) => ({
    id: u.id,
    role: u.role,
    isSuperAdmin: u.isSuperAdmin === true,
  }),
}))

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number
    private headerMap: Map<string, string>
    body: unknown
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body
      this.status = init?.status ?? 200
      this.headerMap = new Map(Object.entries(init?.headers ?? {}))
    }
    get headers() {
      return { get: (key: string) => this.headerMap.get(key) ?? null }
    }
    static json(data: unknown, init?: { status?: number }) {
      return {
        status: init?.status ?? 200,
        json: async () => data,
        headers: { get: () => null },
      }
    }
  }
  return { NextResponse: MockNextResponse }
})

import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import {
  assertInventoryResourceRead,
  assertInventoryResourceManage,
  InventoryAccessError,
} from '@/lib/inventory/inventory-resource-access'
import { GET, DELETE } from '@/app/api/inventory/equipment/[id]/attachments/[attachmentId]/route'

const EQUIPMENT_ID = 'eq-1'
const ATTACHMENT_ID = 'att-1'

function params() {
  return { params: Promise.resolve({ id: EQUIPMENT_ID, attachmentId: ATTACHMENT_ID }) }
}

function getReq(preview = false) {
  return { nextUrl: new URL(`https://app.test/x?preview=${preview}`) } as any
}

describe('GET /api/inventory/equipment/[id]/attachments/[attachmentId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('regresión: sin sesión, 401 — no llega a leer el adjunto', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const res = await GET(getReq(), params())

    expect(res.status).toBe(401)
    expect(prisma.equipment_attachments.findFirst).not.toHaveBeenCalled()
  })

  it('regresión: con sesión pero fuera de scope de familia, 403 — no llega a leer el adjunto', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(assertInventoryResourceRead as jest.Mock).mockRejectedValue(
      new InventoryAccessError('No tienes acceso a este equipo', 403)
    )

    const res = await GET(getReq(), params())

    expect(res.status).toBe(403)
    expect(prisma.equipment_attachments.findFirst).not.toHaveBeenCalled()
  })

  it('un adjunto con mimeType peligroso en BD (legado) se sirve como octet-stream aunque pida preview', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(assertInventoryResourceRead as jest.Mock).mockResolvedValue(null)
    ;(prisma.equipment_attachments.findFirst as jest.Mock).mockResolvedValue({
      id: ATTACHMENT_ID,
      equipmentId: EQUIPMENT_ID,
      path: '/uploads/equipment/eq-1/x.html',
      mimeType: 'text/html',
      originalName: 'evil.html',
      size: 10,
    })

    const res = await GET(getReq(true), params())

    expect(res.headers.get('Content-Type')).toBe('application/octet-stream')
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment/)
  })

  it('un PDF real con preview=true se sirve inline con su mimeType real', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(assertInventoryResourceRead as jest.Mock).mockResolvedValue(null)
    ;(prisma.equipment_attachments.findFirst as jest.Mock).mockResolvedValue({
      id: ATTACHMENT_ID,
      equipmentId: EQUIPMENT_ID,
      path: '/uploads/equipment/eq-1/x.pdf',
      mimeType: 'application/pdf',
      originalName: 'factura.pdf',
      size: 10,
    })

    const res = await GET(getReq(true), params())

    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toMatch(/^inline/)
  })

  it('un attachmentId de OTRO equipo (equipmentId no coincide) no se sirve — findFirst scopea por ambos', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(assertInventoryResourceRead as jest.Mock).mockResolvedValue(null)
    ;(prisma.equipment_attachments.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await GET(getReq(), params())

    expect(res.status).toBe(404)
    expect(prisma.equipment_attachments.findFirst).toHaveBeenCalledWith({
      where: { id: ATTACHMENT_ID, equipmentId: EQUIPMENT_ID },
    })
  })
})

describe('DELETE /api/inventory/equipment/[id]/attachments/[attachmentId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('regresión: un gestor con canManageInventory GLOBAL pero fuera de la familia del equipo recibe 403', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', role: 'TECHNICIAN', isSuperAdmin: false },
    })
    ;(assertInventoryResourceManage as jest.Mock).mockRejectedValue(
      new InventoryAccessError('No tienes permisos para gestionar recursos de esta familia', 403)
    )

    const res = await DELETE({} as any, params())

    expect(res.status).toBe(403)
    expect(prisma.equipment_attachments.delete).not.toHaveBeenCalled()
  })

  it('dentro de scope, borra el adjunto scopeado por equipmentId', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(assertInventoryResourceManage as jest.Mock).mockResolvedValue(null)
    ;(prisma.equipment_attachments.findFirst as jest.Mock).mockResolvedValue({
      id: ATTACHMENT_ID,
      equipmentId: EQUIPMENT_ID,
      path: '/uploads/equipment/eq-1/x.pdf',
      originalName: 'factura.pdf',
      equipment: { code: 'EQ-001' },
    })
    ;(prisma.equipment_attachments.findUnique as jest.Mock).mockResolvedValue({
      id: ATTACHMENT_ID,
      equipmentId: EQUIPMENT_ID,
      path: '/uploads/equipment/eq-1/x.pdf',
      storageProvider: 'local',
      externalId: null,
    })

    const res = await DELETE({} as any, params())

    expect(res.status).toBe(200)
    expect(prisma.equipment_attachments.findFirst).toHaveBeenCalledWith({
      where: { id: ATTACHMENT_ID, equipmentId: EQUIPMENT_ID },
      include: { equipment: { select: { code: true } } },
    })
    expect(prisma.equipment_attachments.delete).toHaveBeenCalledWith({
      where: { id: ATTACHMENT_ID },
    })
  })
})
