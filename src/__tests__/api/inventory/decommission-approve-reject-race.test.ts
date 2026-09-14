/**
 * POST .../approve, .../reject, .../elevate sobre decommission_requests
 *
 * Ninguna de las tres rutas repetía el filtro de estado en el `where` de su
 * `update` final — solo lo comprobaban leyendo la fila ANTES de escribir.
 * Un /approve y un /reject (o /elevate) casi simultáneos sobre la misma
 * solicitud en MANAGER_REVIEW pasaban ambos su respectivo chequeo de estado
 * (leído antes de que cualquiera escribiera) y podían terminar en un estado
 * inconsistente: equipo RETIRED + acta generada, pero la solicitud pisada a
 * REJECTED por el otro request (o viceversa).
 *
 * Fix: `updateMany({ where: { id, status: { in: [...] } } })` + 409 si
 * `count === 0` — mismo patrón de claim atómico ya usado en Tickets/
 * Credenciales/Backups esta sesión.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/branding', () => ({
  getSystemBranding: jest.fn().mockResolvedValue({ systemName: 'Sistema' }),
}))
jest.mock('@/lib/api/notify', () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyFamilyScopedAdmins: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/templates/decommission-act-pdf.template', () => ({
  generateDecommissionActPDF: jest.fn(),
}))
jest.mock('@/lib/upload-path', () => ({ getUploadDir: (...s: string[]) => s.join('/') }))
jest.mock('fs/promises', () => ({ mkdir: jest.fn() }))
jest.mock('fs', () => ({ existsSync: jest.fn(() => true), createWriteStream: jest.fn() }))
jest.mock('@/lib/inventory/equipment-contract', () => ({
  getDecommissionContractImpact: jest.fn().mockResolvedValue(null),
  releaseEquipmentFromContracts: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/inventory/license-contract', () => ({
  getDecommissionContractImpactForLicense: jest.fn().mockResolvedValue(null),
  releaseLicenseFromContracts: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/inventory-access', () => ({
  canApproveDecommission: jest.fn().mockResolvedValue(true),
  isAdminOfFamily: jest.fn().mockResolvedValue(true),
  isManagerOfFamily: jest.fn().mockResolvedValue(true),
}))
jest.mock('@/lib/inventory/inventory-session', () => ({
  resolveCanManageInventory: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    decommission_requests: { findUnique: jest.fn(), updateMany: jest.fn() },
    equipment_assignments: { findFirst: jest.fn().mockResolvedValue(null) },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
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
import { notifyUser, notifyFamilyScopedAdmins } from '@/lib/api/notify'
import { POST as approvePOST } from '@/app/api/inventory/decommission-acts/[id]/approve/route'
import { POST as rejectPOST } from '@/app/api/inventory/decommission-acts/[id]/reject/route'
import { POST as elevatePOST } from '@/app/api/inventory/decommission-acts/[id]/elevate/route'

function params() {
  return { params: Promise.resolve({ id: 'req-1' }) }
}

function baseRequest(status: string) {
  return {
    id: 'req-1',
    status,
    assetType: 'EQUIPMENT',
    equipmentId: 'eq-1',
    licenseId: null,
    equipment: { id: 'eq-1', code: 'EQ-1', brand: 'B', model: 'M', type: { familyId: 'fam-1' } },
    license: null,
    requester: { id: 'client-1', name: 'Cliente', email: 'c@x.com' },
    attachments: [],
  }
}

function jsonReq(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

describe('POST .../approve — claim atómico', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.decommission_requests.findUnique as jest.Mock).mockResolvedValue(
      baseRequest('MANAGER_REVIEW')
    )
  })

  it('regresión: si otra petición ya cambió el estado (perdió la carrera), responde 409 sin generar acta', async () => {
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        decommission_requests: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        folio_counters: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
        equipment: { update: jest.fn() },
        decommission_acts: { create: jest.fn() },
      }
      return cb(tx)
    })

    const res = await approvePOST({} as any, params())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/cambió de estado/)
  })

  it('gana la carrera: claim exitoso, el `where` del updateMany exige el estado leído', async () => {
    let capturedWhere: unknown
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        decommission_requests: {
          updateMany: jest.fn().mockImplementation(({ where }: any) => {
            capturedWhere = where
            return Promise.resolve({ count: 1 })
          }),
        },
        folio_counters: {
          findUnique: jest.fn().mockResolvedValue({ lastNumber: 4 }),
          update: jest.fn().mockResolvedValue({ lastNumber: 5 }),
          create: jest.fn(),
        },
        equipment: { update: jest.fn().mockResolvedValue({}) },
        decommission_acts: {
          create: jest.fn().mockResolvedValue({
            id: 'act-1',
            folio: 'BAJA-2026-00005',
            approvedAt: new Date(),
          }),
        },
      }
      return cb(tx)
    })

    const res = await approvePOST({} as any, params())

    expect(res.status).toBe(200)
    expect(capturedWhere).toEqual({
      id: 'req-1',
      status: { in: ['PENDING', 'MANAGER_REVIEW'] },
    })
  })
})

describe('POST .../reject — claim atómico', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.decommission_requests.findUnique as jest.Mock).mockResolvedValue(
      baseRequest('MANAGER_REVIEW')
    )
  })

  it('regresión: si otra petición ya cambió el estado, responde 409 sin notificar', async () => {
    ;(prisma.decommission_requests.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await rejectPOST(
      jsonReq({ rejectionReason: 'Motivo suficientemente largo' }),
      params()
    )
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/cambió de estado/)
    expect(notifyUser).not.toHaveBeenCalled()
  })
})

describe('POST .../elevate — claim atómico', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'manager-1', role: 'TECHNICIAN', isSuperAdmin: false },
    })
    ;(prisma.decommission_requests.findUnique as jest.Mock).mockResolvedValue(
      baseRequest('TECHNICAL_REVIEW')
    )
  })

  it('regresión: si otra petición ya cambió el estado, responde 409 sin notificar a los admins', async () => {
    ;(prisma.decommission_requests.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await elevatePOST(jsonReq({ notes: 'ok' }), params())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/cambió de estado/)
    expect(notifyFamilyScopedAdmins).not.toHaveBeenCalled()
  })
})
