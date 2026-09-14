/**
 * /api/access-organizations (catálogo global) y /api/access-organizations/[id]
 *
 * access_organizations no tiene familyId (catálogo global, lo usan todas las
 * áreas). Antes cualquier gestor con canManageAccess en UNA área podía
 * renombrar/desactivar/borrar una organización que otras áreas usan, sin
 * ninguna auditoría, y el POST validaba a mano (`typeof body.x === 'string'`)
 * con un `findUnique` previo al `create` que además era una carrera contra el
 * índice único de `code` (P2002 sin manejar → 500).
 *
 * Fix: Zod en POST/PUT, auditoría en las 4 mutaciones, autorización por "uso
 * cruzado" (isAccessOrganizationInScope: el gestor de un área no puede tocar
 * una organización usada por access_subjects fuera de su scope), P2002
 * manejado como 409, y el rename se propaga a access_subjects.organization
 * (copia denormalizada) en la misma transacción.
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
    users: { findUnique: jest.fn() },
    access_organizations: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { order: 0 } }),
    },
    access_subjects: {
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}))

jest.mock('@/lib/auth/user-family-access', () => ({
  resolveModuleFamilyScopeIds: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditActionsComplete: {
    ACCESS_ORGANIZATION_CREATED: 'access_organization_created',
    ACCESS_ORGANIZATION_UPDATED: 'access_organization_updated',
    ACCESS_ORGANIZATION_DEACTIVATED: 'access_organization_deactivated',
    ACCESS_ORGANIZATION_DELETED: 'access_organization_deleted',
  },
  AuditServiceComplete: { log: jest.fn() },
}))

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
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { POST } from '@/app/api/access-organizations/route'
import { PUT, DELETE } from '@/app/api/access-organizations/[id]/route'

const ADMIN_ID = 'admin-1'
const ORG_ID = 'org-1'

function makeJsonRequest(body: unknown) {
  return { json: async () => body } as any
}

function asSuperAdmin() {
  ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
    isActive: true,
    isSuperAdmin: true,
    role: 'ADMIN',
    accessEnabled: true,
    canManageAccess: true,
  })
}

function asAreaManager() {
  ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
    isActive: true,
    isSuperAdmin: false,
    role: 'ADMIN',
    accessEnabled: true,
    canManageAccess: true,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: ADMIN_ID, role: 'ADMIN' } })
  ;(prisma.$transaction as jest.Mock).mockImplementation((ops: Promise<unknown>[]) =>
    Promise.all(ops)
  )
})

describe('POST /api/access-organizations', () => {
  it('devuelve 409 (no 500) cuando el create choca contra el índice único de code', async () => {
    asSuperAdmin()
    ;(prisma.access_organizations.create as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: { target: ['access_organizations_code_key'] },
    })

    const res = await POST(makeJsonRequest({ name: 'ACME Corp', code: 'ACME' }))

    expect(res.status).toBe(409)
  })

  it('camino feliz: crea y audita', async () => {
    asSuperAdmin()
    ;(prisma.access_organizations.create as jest.Mock).mockResolvedValue({
      id: ORG_ID,
      code: 'ACME',
      name: 'ACME Corp',
    })

    const res = await POST(makeJsonRequest({ name: 'ACME Corp', code: 'ACME' }))

    expect(res.status).toBe(201)
    expect(AuditServiceComplete.log).toHaveBeenCalledTimes(1)
  })

  it('rechaza datos inválidos con 400 sin llegar a Prisma', async () => {
    asSuperAdmin()

    const res = await POST(makeJsonRequest({ name: 'A' }))

    expect(res.status).toBe(400)
    expect(prisma.access_organizations.create).not.toHaveBeenCalled()
  })
})

describe('PUT /api/access-organizations/[id]', () => {
  function callPut(body: unknown) {
    return PUT(makeJsonRequest(body), { params: Promise.resolve({ id: ORG_ID }) })
  }

  it('rechaza con 403 si hay subjects fuera del scope del gestor de área', async () => {
    asAreaManager()
    const { resolveModuleFamilyScopeIds } = jest.requireMock('@/lib/auth/user-family-access')
    ;(resolveModuleFamilyScopeIds as jest.Mock).mockResolvedValue(['family-allowed'])
    ;(prisma.access_organizations.findUnique as jest.Mock).mockResolvedValue({
      id: ORG_ID,
      name: 'ACME',
      description: null,
    })
    ;(prisma.access_subjects.count as jest.Mock).mockResolvedValue(1) // hay uno fuera de scope

    const res = await callPut({ name: 'ACME Corp Renombrada' })

    expect(res.status).toBe(403)
    expect(prisma.access_organizations.update).not.toHaveBeenCalled()
  })

  it('permite editar si todos los subjects que usan la organización están en scope', async () => {
    asAreaManager()
    const { resolveModuleFamilyScopeIds } = jest.requireMock('@/lib/auth/user-family-access')
    ;(resolveModuleFamilyScopeIds as jest.Mock).mockResolvedValue(['family-allowed'])
    ;(prisma.access_organizations.findUnique as jest.Mock).mockResolvedValue({
      id: ORG_ID,
      name: 'ACME',
      description: null,
    })
    ;(prisma.access_subjects.count as jest.Mock).mockResolvedValue(0) // ninguno fuera de scope
    ;(prisma.access_organizations.update as jest.Mock).mockResolvedValue({
      id: ORG_ID,
      name: 'ACME Corp Renombrada',
      description: null,
    })

    const res = await callPut({ name: 'ACME Corp Renombrada' })

    expect(res.status).toBe(200)
  })

  it('propaga el rename a access_subjects.organization en la misma transacción', async () => {
    asSuperAdmin()
    ;(prisma.access_organizations.findUnique as jest.Mock).mockResolvedValue({
      id: ORG_ID,
      name: 'ACME',
      description: null,
    })
    ;(prisma.access_organizations.update as jest.Mock).mockResolvedValue({
      id: ORG_ID,
      name: 'ACME Renombrada',
      description: null,
    })

    await callPut({ name: 'ACME Renombrada' })

    expect(prisma.access_subjects.updateMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID },
      data: { organization: 'ACME Renombrada' },
    })
    expect(AuditServiceComplete.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'access_organization_updated',
        details: expect.objectContaining({ subjectsRenamed: true }),
      })
    )
  })

  it('no toca access_subjects si el nombre no cambió', async () => {
    asSuperAdmin()
    ;(prisma.access_organizations.findUnique as jest.Mock).mockResolvedValue({
      id: ORG_ID,
      name: 'ACME',
      description: null,
    })
    ;(prisma.access_organizations.update as jest.Mock).mockResolvedValue({
      id: ORG_ID,
      name: 'ACME',
      description: 'nueva descripción',
    })

    await callPut({ name: 'ACME', description: 'nueva descripción' })

    expect(prisma.access_subjects.updateMany).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/access-organizations/[id]', () => {
  function callDelete() {
    return DELETE({} as any, { params: Promise.resolve({ id: ORG_ID }) })
  }

  it('rechaza con 403 si hay subjects fuera del scope del gestor de área', async () => {
    asAreaManager()
    const { resolveModuleFamilyScopeIds } = jest.requireMock('@/lib/auth/user-family-access')
    ;(resolveModuleFamilyScopeIds as jest.Mock).mockResolvedValue(['family-allowed'])
    ;(prisma.access_organizations.findUnique as jest.Mock).mockResolvedValue({
      id: ORG_ID,
      code: 'ACME',
      name: 'ACME',
    })
    ;(prisma.access_subjects.count as jest.Mock).mockResolvedValue(1)

    const res = await callDelete()

    expect(res.status).toBe(403)
    expect(prisma.access_organizations.delete).not.toHaveBeenCalled()
  })

  it('desactiva (no borra) y audita cuando está en uso', async () => {
    asSuperAdmin()
    ;(prisma.access_organizations.findUnique as jest.Mock).mockResolvedValue({
      id: ORG_ID,
      code: 'ACME',
      name: 'ACME',
    })
    ;(prisma.access_subjects.count as jest.Mock).mockResolvedValue(3)

    const res = await callDelete()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deactivated).toBe(true)
    expect(prisma.access_organizations.delete).not.toHaveBeenCalled()
    expect(AuditServiceComplete.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'access_organization_deactivated' })
    )
  })

  it('borra definitivamente y audita cuando no está en uso', async () => {
    asSuperAdmin()
    ;(prisma.access_organizations.findUnique as jest.Mock).mockResolvedValue({
      id: ORG_ID,
      code: 'ACME',
      name: 'ACME',
    })
    ;(prisma.access_subjects.count as jest.Mock).mockResolvedValue(0)

    const res = await callDelete()

    expect(res.status).toBe(200)
    expect(prisma.access_organizations.delete).toHaveBeenCalledWith({ where: { id: ORG_ID } })
    expect(AuditServiceComplete.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'access_organization_deleted' })
    )
  })
})
