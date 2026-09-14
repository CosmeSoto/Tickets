/**
 * POST /api/credentials/entries/[id]/reveal y /copy
 *
 * Bug real: `AuditServiceComplete.log` traga cualquier excepción (para no
 * tumbar a sus ~180 callers) y nunca lanza — con lo cual el patrón
 * `await AuditServiceComplete.log(...)` seguido de `return secret` devolvía
 * el secreto SIEMPRE, incluso si la escritura del log de auditoría había
 * fallado en silencio (BD caída, columna no migrada, etc.). La UI promete
 * literalmente "queda auditado" al revelar/copiar una credencial — sin
 * rastro de auditoría esa garantía se rompe.
 *
 * El fix hace que `log()` devuelva `true`/`false` (sin cambiar su contrato
 * de "nunca lanza" para el resto de callers) y que reveal/copy comprueben
 * ese booleano: si la auditoría no se pudo persistir, no se devuelve el
 * secreto.
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
    credential_entries: { findFirst: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('@/lib/credentials/access', () => ({
  checkCredentialsModuleAccess: jest.fn().mockResolvedValue(true),
  userCanAccessEntry: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/services/encryption.service', () => ({
  EncryptionService: { decrypt: jest.fn(() => 'S3cr3t!') },
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditServiceComplete: { log: jest.fn() },
  AuditActionsComplete: {
    CREDENTIAL_REVEALED: 'CREDENTIAL_REVEALED',
    CREDENTIAL_COPIED: 'CREDENTIAL_COPIED',
  },
}))

// El `NextResponse` real no reconstruye el body vía `.json()` en este
// entorno de Jest (sin los polyfills de fetch de Next) — mismo mock usado en
// otras suites de la sesión (p. ej. error-surfacing.test.ts de Noticias).
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
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { POST as revealPOST } from '@/app/api/credentials/entries/[id]/reveal/route'
import { POST as copyPOST } from '@/app/api/credentials/entries/[id]/copy/route'

const ENTRY_ID = 'entry-1'

function params() {
  return { params: Promise.resolve({ id: ENTRY_ID }) }
}

function makeRequest() {
  return new Request(`https://app.test/api/credentials/entries/${ENTRY_ID}/reveal`, {
    method: 'POST',
  })
}

describe.each([
  ['reveal', revealPOST],
  ['copy', copyPOST],
])('POST .../%s — auditoría fail-closed', (_name, handler) => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.credential_entries.findFirst as jest.Mock).mockResolvedValue({
      id: ENTRY_ID,
      title: 'Router core',
      vaultId: 'vault-1',
      secretEncrypted: 'enc:...',
      createdById: 'user-1',
      vault: { kind: 'AREA', familyId: 'fam-1', ownerUserId: null },
    })
  })

  it('si el log de auditoría falla (log() devuelve false), NO devuelve el secreto', async () => {
    ;(AuditServiceComplete.log as jest.Mock).mockResolvedValue(false)

    const res = await handler(makeRequest(), params())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.secret).toBeUndefined()
    expect(prisma.credential_entries.update).not.toHaveBeenCalled()
  })

  it('si la auditoría se registra (log() devuelve true), devuelve el secreto y actualiza lastRevealedAt', async () => {
    ;(AuditServiceComplete.log as jest.Mock).mockResolvedValue(true)

    const res = await handler(makeRequest(), params())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.secret).toBe('S3cr3t!')
    expect(prisma.credential_entries.update).toHaveBeenCalledWith({
      where: { id: ENTRY_ID },
      data: { lastRevealedAt: expect.any(Date) },
    })
  })
})
