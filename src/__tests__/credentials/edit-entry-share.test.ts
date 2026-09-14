/**
 * userCanEditEntry — un share con capability EDIT (elegido por quien
 * comparte, ver ShareCredentialDialog) debe habilitar PATCH aunque el
 * destinatario no sea dueño ni gestor de jerarquía; un share VIEW no.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn() },
    credential_shares: { findFirst: jest.fn() },
  },
}))

import prisma from '@/lib/prisma'
import { userCanEditEntry, userCanMutateEntry } from '@/lib/credentials/access'

const VIEWER = { userId: 'viewer-1', role: 'TECHNICIAN', isSuperAdmin: false }
const ENTRY = {
  id: 'entry-1',
  createdById: 'owner-1',
  vault: { familyId: 'fam-1', ownerUserId: null, kind: 'AREA' },
}

describe('userCanEditEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Módulo activo y sin permiso de gestionar jerarquía: ni dueño ni gestor.
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      credentialsEnabled: true,
      isActive: true,
      canManageCredentials: false,
    })
  })

  it('sin share y sin jerarquía: no puede editar', async () => {
    ;(prisma.credential_shares.findFirst as jest.Mock).mockResolvedValue(null)
    expect(await userCanMutateEntry(VIEWER, ENTRY)).toBe(false)
    expect(await userCanEditEntry(VIEWER, ENTRY)).toBe(false)
  })

  it('share con capability VIEW: no otorga editar', async () => {
    ;(prisma.credential_shares.findFirst as jest.Mock).mockResolvedValue(null) // filtro EDIT/ADMIN no matchea VIEW
    expect(await userCanEditEntry(VIEWER, ENTRY)).toBe(false)
  })

  it('share con capability EDIT: sí otorga editar (aunque no sea dueño ni gestor)', async () => {
    ;(prisma.credential_shares.findFirst as jest.Mock).mockResolvedValue({ id: 'share-1' })
    expect(await userCanEditEntry(VIEWER, ENTRY)).toBe(true)
    // Pero sigue sin poder borrar ni gestionar compartidos:
    expect(await userCanMutateEntry(VIEWER, ENTRY)).toBe(false)
  })

  it('dueño puede editar sin necesitar share', async () => {
    const owner = { userId: 'owner-1', role: 'TECHNICIAN', isSuperAdmin: false }
    ;(prisma.credential_shares.findFirst as jest.Mock).mockResolvedValue(null)
    expect(await userCanEditEntry(owner, ENTRY)).toBe(true)
  })
})
