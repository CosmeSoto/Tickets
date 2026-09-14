/**
 * GET/POST/DELETE/PUT /api/cache
 *
 * Ninguno de los 4 métodos tenía autenticación. El más grave: `POST
 * {action:"clear", pattern:"*"}` / `DELETE ?pattern=*` ejecutan
 * `redis.keys(pattern)` + `redis.del(...)` con el patrón tal cual lo manda
 * el cliente, sin restringirlo al namespace `app:` de la app — un
 * atacante SIN sesión podía vaciar TODO el Redis compartido (rate
 * limiting, presencia SSE, colas de notificación) enviando `pattern: '*'`.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/auth/require-super-admin', () => ({ requireSuperAdmin: jest.fn() }))
jest.mock('@/lib/cache', () => ({
  cacheService: {
    getStats: jest.fn(),
    getHitRatio: jest.fn(),
    clear: jest.fn(),
    delete: jest.fn(),
    set: jest.fn(),
    resetStats: jest.fn(),
    invalidateByTags: jest.fn(),
  },
}))
jest.mock('@/services/cached-services', () => ({
  cacheManagementService: {
    getCacheHealth: jest.fn(),
    clearAllCaches: jest.fn(),
    invalidateEntity: jest.fn(),
    warmUpCaches: jest.fn(),
  },
}))
jest.mock('@/lib/cache-middleware', () => ({
  CacheInvalidation: { purgeExpired: jest.fn() },
}))

import { getServerSession } from 'next-auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { cacheService } from '@/lib/cache'
import { GET, POST, DELETE, PUT } from '@/app/api/cache/route'

function req(url: string, init?: { method?: string; body?: unknown }) {
  return {
    url,
    json: async () => init?.body ?? {},
  } as any
}

describe('/api/cache — requiere Super Admin en los 4 métodos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('regresión GET: sin sesión, 401/403 sin ejecutar ninguna operación de caché', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      error: 'No autorizado',
    })

    const res = await GET(req('http://localhost/api/cache?action=stats'))

    expect(res.status).toBe(401)
    expect(cacheService.getStats).not.toHaveBeenCalled()
  })

  it('regresión POST: sin sesión, un pattern "*" NO llega a cacheService.clear', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      error: 'No autorizado',
    })

    const res = await POST(
      req('http://localhost/api/cache', { body: { action: 'clear', pattern: '*' } })
    )

    expect(res.status).toBe(401)
    expect(cacheService.clear).not.toHaveBeenCalled()
  })

  it('regresión DELETE: sin sesión, ?pattern=* NO llega a cacheService.clear', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      error: 'No autorizado',
    })

    const res = await DELETE(req('http://localhost/api/cache?pattern=*'))

    expect(res.status).toBe(401)
    expect(cacheService.clear).not.toHaveBeenCalled()
  })

  it('regresión PUT: un ADMIN scoped (no super) recibe 403, no escribe en caché', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Solo el Super Administrador puede realizar esta acción',
    })

    const res = await PUT(req('http://localhost/api/cache', { body: { key: 'x', value: 'y' } }))

    expect(res.status).toBe(403)
    expect(cacheService.set).not.toHaveBeenCalled()
  })

  it('un Super Admin sí puede limpiar la caché', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'super-1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({ ok: true })
    ;(cacheService.clear as jest.Mock).mockResolvedValue(3)

    const res = await POST(
      req('http://localhost/api/cache', { body: { action: 'clear', pattern: 'app:foo:*' } })
    )

    expect(res.status).toBe(200)
    expect(cacheService.clear).toHaveBeenCalledWith('app:foo:*')
  })
})
