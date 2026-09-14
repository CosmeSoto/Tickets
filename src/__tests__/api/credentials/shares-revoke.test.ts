/**
 * DELETE /api/credentials/entries/[id]/shares
 *
 * Bug real: `credential_shares` no tiene `@@unique([entryId, userId])` en el
 * schema (solo `@@index([entryId])`) y el POST de esta misma ruta hace
 * `findFirst` (chequeo) → `create` sin ninguna garantía atómica. Un doble
 * clic o un reintento de red puede crear DOS filas para el mismo
 * (entryId, userId). El DELETE revocaba con `findFirst` + `delete({where:
 * {id}})` — borraba UNA sola fila. La revocación devolvía éxito, pero
 * `userCanAccessEntry` solo comprueba que EXISTA algún share (sin importar
 * cuántos), así que el usuario "revocado" seguía viendo y revelando la
 * credencial a través de la fila que quedó viva.
 *
 * El fix usa `deleteMany` con el mismo filtro: borra TODAS las filas
 * coincidentes de una vez, sin depender de que el schema tenga unicidad.
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
    credential_shares: { findMany: jest.fn(), deleteMany: jest.fn() },
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
  AuditServiceComplete: { log: jest.fn().mockResolvedValue(undefined) },
  AuditActionsComplete: {
    CREDENTIAL_SHARE_REVOKED: 'CREDENTIAL_SHARE_REVOKED',
    CREDENTIAL_SHARED: 'CREDENTIAL_SHARED',
  },
}))

jest.mock('@/lib/api/notify', () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined),
}))

import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { DELETE } from '@/app/api/credentials/entries/[id]/shares/route'

const ENTRY_ID = 'entry-1'
const TARGET_USER_ID = 'user-target'

function params() {
  return { params: Promise.resolve({ id: ENTRY_ID }) }
}

function makeRequest(query: string) {
  return new Request(`https://app.test/api/credentials/entries/${ENTRY_ID}/shares?${query}`, {
    method: 'DELETE',
  })
}

describe('DELETE /api/credentials/entries/[id]/shares', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'owner-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.credential_entries.findFirst as jest.Mock).mockResolvedValue({
      id: ENTRY_ID,
      title: 'Router core',
      createdById: 'owner-1',
      vault: { kind: 'AREA', familyId: 'fam-1', ownerUserId: null },
    })
  })

  it('borra TODAS las filas duplicadas del mismo (entryId, userId) en una sola revocación', async () => {
    ;(prisma.credential_shares.findMany as jest.Mock).mockResolvedValue([
      { id: 'share-1', entryId: ENTRY_ID, userId: TARGET_USER_ID, capability: 'VIEW' },
      { id: 'share-2', entryId: ENTRY_ID, userId: TARGET_USER_ID, capability: 'VIEW' },
    ])

    const res = await DELETE(makeRequest(`userId=${TARGET_USER_ID}`), params())

    expect(res.status).toBe(200)
    expect(prisma.credential_shares.deleteMany).toHaveBeenCalledWith({
      where: { entryId: ENTRY_ID, userId: TARGET_USER_ID },
    })
    // No debe quedar ningún camino que borre una sola fila por id
    expect(prisma.credential_shares.deleteMany).toHaveBeenCalledTimes(1)
  })

  it('404 si no hay ninguna fila que coincida', async () => {
    ;(prisma.credential_shares.findMany as jest.Mock).mockResolvedValue([])

    const res = await DELETE(makeRequest(`userId=${TARGET_USER_ID}`), params())

    expect(res.status).toBe(404)
    expect(prisma.credential_shares.deleteMany).not.toHaveBeenCalled()
  })

  it('revocar por shareId también usa deleteMany con ese filtro exacto', async () => {
    ;(prisma.credential_shares.findMany as jest.Mock).mockResolvedValue([
      { id: 'share-1', entryId: ENTRY_ID, userId: TARGET_USER_ID, capability: 'VIEW' },
    ])

    const res = await DELETE(makeRequest('shareId=share-1'), params())

    expect(res.status).toBe(200)
    expect(prisma.credential_shares.deleteMany).toHaveBeenCalledWith({
      where: { entryId: ENTRY_ID, id: 'share-1' },
    })
  })
})
