/**
 * assertCanModifyNews (src/lib/news/news-manage-access.ts)
 *
 * Bug de seguridad real: para `role === 'ADMIN'` con `newsEnabled`, la
 * función devolvía `null` (autorizado) sin ningún chequeo de scope de
 * familia ni de autoría — cualquier ADMIN podía editar/borrar CUALQUIER
 * noticia del sistema, incluidas las de otras familias y las creadas por
 * Super Admin. El GET hermano (`admin/news/[id]/route.ts`) sí validaba el
 * alcance real con `buildNewsVisibilityConditions`, así que GET era más
 * estricto que PUT/DELETE sobre el mismo recurso.
 *
 * El fix aplica el mismo criterio de alcance que el GET: autoría siempre
 * alcanza (cualquier rol); un ADMIN no autor solo puede gestionar noticias
 * dentro de su scope de visibilidad (`buildNewsVisibilityConditions`), no
 * cualquier noticia del sistema.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn() },
    news: { findUnique: jest.fn(), count: jest.fn() },
  },
  prisma: {
    users: { findUnique: jest.fn() },
    news: { findUnique: jest.fn(), count: jest.fn() },
  },
}))

jest.mock('@/lib/auth/user-family-access', () => ({
  resolveModuleFamilyScopeIds: jest.fn().mockResolvedValue([]),
}))

import { prisma } from '@/lib/prisma'
import { assertCanModifyNews } from '@/lib/news/news-manage-access'

const NEWS_ID = 'news-1'
const AUTHOR_ID = 'author-1'
const ADMIN_ID = 'admin-1'

function mockUser(overrides: Record<string, unknown>) {
  ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
    role: 'TECHNICIAN',
    newsEnabled: false,
    isSuperAdmin: false,
    departments: null,
    ...overrides,
  })
}

describe('assertCanModifyNews', () => {
  beforeEach(() => jest.clearAllMocks())

  it('permite siempre al autor de la noticia, sin importar el rol', async () => {
    mockUser({ role: 'TECHNICIAN' })
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue({ createdById: AUTHOR_ID })

    const denied = await assertCanModifyNews(NEWS_ID, AUTHOR_ID)

    expect(denied).toBeNull()
    expect(prisma.news.count).not.toHaveBeenCalled()
  })

  it('rechaza a un no-ADMIN que no es el autor (regla existente, no debe romperse)', async () => {
    mockUser({ role: 'TECHNICIAN', canManageNews: true, newsEnabled: true })
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue({ createdById: AUTHOR_ID })

    const denied = await assertCanModifyNews(NEWS_ID, 'other-tech')

    expect(denied?.status).toBe(403)
  })

  it('rechaza a un ADMIN fuera de su alcance de visibilidad (regresión del bug)', async () => {
    mockUser({ role: 'ADMIN', newsEnabled: true, departments: { familyId: 'family-a' } })
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue({ createdById: 'someone-else' })
    ;(prisma.news.count as jest.Mock).mockResolvedValue(0) // fuera de scope

    const denied = await assertCanModifyNews(NEWS_ID, ADMIN_ID)

    expect(denied?.status).toBe(403)
  })

  it('permite a un ADMIN dentro de su alcance de visibilidad, aunque no sea el autor', async () => {
    mockUser({ role: 'ADMIN', newsEnabled: true, departments: { familyId: 'family-a' } })
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue({ createdById: 'someone-else' })
    ;(prisma.news.count as jest.Mock).mockResolvedValue(1) // dentro de scope

    const denied = await assertCanModifyNews(NEWS_ID, ADMIN_ID)

    expect(denied).toBeNull()
  })

  it('rechaza a un ADMIN con newsEnabled desactivado, incluso dentro de scope', async () => {
    mockUser({ role: 'ADMIN', newsEnabled: false })
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue({ createdById: 'someone-else' })

    const denied = await assertCanModifyNews(NEWS_ID, ADMIN_ID)

    expect(denied?.status).toBe(403)
    expect(prisma.news.count).not.toHaveBeenCalled()
  })

  it('Super Admin puede gestionar cualquier noticia sin consultar scope', async () => {
    mockUser({ role: 'ADMIN', isSuperAdmin: true })
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue({ createdById: 'someone-else' })

    const denied = await assertCanModifyNews(NEWS_ID, 'super-1')

    expect(denied).toBeNull()
    expect(prisma.news.findUnique).not.toHaveBeenCalled()
  })

  it('404 si la noticia no existe', async () => {
    mockUser({ role: 'ADMIN', newsEnabled: true })
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue(null)

    const denied = await assertCanModifyNews(NEWS_ID, ADMIN_ID)

    expect(denied?.status).toBe(404)
  })
})
