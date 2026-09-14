/**
 * POST /api/credentials/entries/[id]/shares
 *
 * `credential_shares` ahora tiene `@@unique([entryId, userId])` en el schema
 * (migración 20260914060454_credential_shares_unique_entry_user). El
 * `findFirst` previo al `create` sigue siendo solo el mensaje amigable del
 * caso común (no una garantía atómica) — dos POST concurrentes para el
 * mismo destinatario ahora chocan contra el `create` (P2002) en vez de
 * crear dos filas para el mismo (entryId, userId).
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
    credential_entries: { findFirst: jest.fn() },
    credential_shares: { findFirst: jest.fn(), create: jest.fn() },
  },
}))

jest.mock('@/lib/credentials/access', () => ({
  checkCredentialsModuleAccess: jest.fn().mockResolvedValue(true),
  userCanMutateEntry: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/credentials/share-scope', () => ({
  assertCanShareCredentialWith: jest.fn(),
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditServiceComplete: { log: jest.fn().mockResolvedValue(true) },
  AuditActionsComplete: { CREDENTIAL_SHARED: 'CREDENTIAL_SHARED' },
}))

jest.mock('@/lib/api/notify', () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

// El `NextResponse` real no reconstruye el body vía `.json()` en este
// entorno de Jest (sin los polyfills de fetch de Next).
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
import { assertCanShareCredentialWith } from '@/lib/credentials/share-scope'
import { POST } from '@/app/api/credentials/entries/[id]/shares/route'

const ENTRY_ID = 'entry-1'
const TARGET_USER_ID = 'user-target'

function params() {
  return { params: Promise.resolve({ id: ENTRY_ID }) }
}

function makeRequest() {
  // El `Request` global de jsdom en este entorno de Jest no implementa
  // `.json()` (no es el runtime fetch completo) — mismo motivo por el que
  // otras rutas POST de la sesión se prueban con un objeto liviano en vez de
  // un `Request` real.
  return {
    json: async () => ({ userId: TARGET_USER_ID }),
    headers: { get: () => 'unknown' },
  } as unknown as Request
}

describe('POST /api/credentials/entries/[id]/shares', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'owner-1', role: 'ADMIN', isSuperAdmin: false, name: 'Owner' },
    })
    ;(prisma.credential_entries.findFirst as jest.Mock).mockResolvedValue({
      id: ENTRY_ID,
      title: 'Router core',
      createdById: 'owner-1',
      vault: { kind: 'AREA', familyId: 'fam-1', ownerUserId: null },
    })
    ;(assertCanShareCredentialWith as jest.Mock).mockResolvedValue({
      ok: true,
      target: { id: TARGET_USER_ID, name: 'Target', email: 't@x.com', role: 'TECHNICIAN' },
    })
    ;(prisma.credential_shares.findFirst as jest.Mock).mockResolvedValue(null) // precheck: no lo ve
  })

  it('carrera detectada por la unique constraint (P2002) durante el create: 409 controlado, no 500', async () => {
    ;(prisma.credential_shares.create as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: { target: ['entry_id', 'user_id'] },
    })

    const res = await POST(makeRequest(), params())

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/ya está compartida/)
  })

  it('sin carrera: crea la comparición normalmente', async () => {
    ;(prisma.credential_shares.create as jest.Mock).mockResolvedValue({
      id: 'share-1',
      entryId: ENTRY_ID,
      userId: TARGET_USER_ID,
      capability: 'VIEW',
    })

    const res = await POST(makeRequest(), params())

    expect(res.status).toBe(201)
  })

  it('un error real de Prisma que no es P2002 sigue devolviendo 500', async () => {
    ;(prisma.credential_shares.create as jest.Mock).mockRejectedValue(new Error('conexión perdida'))

    await expect(POST(makeRequest(), params())).rejects.toThrow('conexión perdida')
  })
})
