/**
 * assertCanModifyForm (src/lib/forms/forms-access.ts)
 *
 * Bug de seguridad real: para `role === 'ADMIN'` con `formsEnabled`, la
 * función devolvía `null` (autorizado) sin ningún chequeo de scope de
 * familia/departamento — cualquier ADMIN podía editar/borrar/reemplazar el
 * adjunto de CUALQUIER documento del sistema, incluidos los de otras
 * familias. El GET hermano (`admin/forms/[id]/route.ts`) sí validaba el
 * alcance real con `buildFormVisibilityConditions`, así que GET era más
 * estricto que PUT/DELETE sobre el mismo recurso.
 *
 * El fix aplica el mismo criterio de alcance que el GET: autoría siempre
 * alcanza (cualquier rol no-ADMIN); un ADMIN no autor solo puede gestionar
 * documentos dentro de su scope de visibilidad
 * (`buildFormVisibilityConditions`), no cualquier documento del sistema.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn() },
    forms: { findUnique: jest.fn(), count: jest.fn() },
  },
  prisma: {
    users: { findUnique: jest.fn() },
    forms: { findUnique: jest.fn(), count: jest.fn() },
  },
}))

jest.mock('@/lib/auth/user-family-access', () => ({
  resolveModuleFamilyScopeIds: jest.fn().mockResolvedValue([]),
}))

import { prisma } from '@/lib/prisma'
import { assertCanModifyForm } from '@/lib/forms/forms-access'

const FORM_ID = 'form-1'
const AUTHOR_ID = 'author-1'
const ADMIN_ID = 'admin-1'

function mockUser(overrides: Record<string, unknown>) {
  ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
    role: 'TECHNICIAN',
    formsEnabled: false,
    isSuperAdmin: false,
    canManageForms: false,
    departments: null,
    ...overrides,
  })
}

describe('assertCanModifyForm', () => {
  beforeEach(() => jest.clearAllMocks())

  it('permite siempre al autor no-ADMIN del documento', async () => {
    ;(prisma.forms.findUnique as jest.Mock).mockResolvedValue({ createdById: AUTHOR_ID })

    const denied = await assertCanModifyForm(FORM_ID, AUTHOR_ID, 'TECHNICIAN', false)

    expect(denied).toBeNull()
    expect(prisma.forms.count).not.toHaveBeenCalled()
  })

  it('rechaza a un no-ADMIN que no es el autor (regla existente, no debe romperse)', async () => {
    ;(prisma.forms.findUnique as jest.Mock).mockResolvedValue({ createdById: AUTHOR_ID })

    const denied = await assertCanModifyForm(FORM_ID, 'other-tech', 'TECHNICIAN', false)

    expect(denied?.status).toBe(403)
  })

  it('rechaza a un ADMIN fuera de su alcance de visibilidad (regresión del bug)', async () => {
    mockUser({ role: 'ADMIN', formsEnabled: true, departments: { familyId: 'family-a' } })
    ;(prisma.forms.count as jest.Mock).mockResolvedValue(0) // fuera de scope

    const denied = await assertCanModifyForm(FORM_ID, ADMIN_ID, 'ADMIN', false)

    expect(denied?.status).toBe(403)
    expect(prisma.forms.findUnique).not.toHaveBeenCalled()
  })

  it('permite a un ADMIN dentro de su alcance de visibilidad, aunque no sea el autor', async () => {
    mockUser({ role: 'ADMIN', formsEnabled: true, departments: { familyId: 'family-a' } })
    ;(prisma.forms.count as jest.Mock).mockResolvedValue(1) // dentro de scope

    const denied = await assertCanModifyForm(FORM_ID, ADMIN_ID, 'ADMIN', false)

    expect(denied).toBeNull()
  })

  it('rechaza a un ADMIN con formsEnabled desactivado, sin llegar a consultar scope', async () => {
    mockUser({ role: 'ADMIN', formsEnabled: false })

    const denied = await assertCanModifyForm(FORM_ID, ADMIN_ID, 'ADMIN', false)

    expect(denied?.status).toBe(403)
    expect(prisma.forms.count).not.toHaveBeenCalled()
  })

  it('Super Admin puede gestionar cualquier documento sin consultar scope ni autoría', async () => {
    const denied = await assertCanModifyForm(FORM_ID, 'super-1', 'ADMIN', true)

    expect(denied).toBeNull()
    expect(prisma.forms.findUnique).not.toHaveBeenCalled()
    expect(prisma.forms.count).not.toHaveBeenCalled()
  })

  it('404 si el documento no existe (caso no-ADMIN)', async () => {
    ;(prisma.forms.findUnique as jest.Mock).mockResolvedValue(null)

    const denied = await assertCanModifyForm(FORM_ID, 'someone', 'TECHNICIAN', false)

    expect(denied?.status).toBe(404)
  })
})
