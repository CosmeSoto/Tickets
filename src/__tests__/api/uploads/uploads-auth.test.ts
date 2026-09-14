/**
 * GET /api/uploads/[...path]
 *
 * Esta ruta es el equivalente autenticado del `/uploads/` estático que
 * nginx dejó de servir (ver `docker/nginx.conf` — el `alias` abierto
 * bypaseaba por completo esta autorización). Estos tests fijan el contrato
 * que nginx ya no protege: solo `landing/`/`avatars/` son públicos, todo lo
 * demás exige sesión, y `..` en el path nunca resuelve.
 */

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/upload-path', () => ({
  getUploadDir: (relativePath: string) => `/uploads-root/${relativePath}`,
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
}))

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('contenido')),
}))

import { getServerSession } from 'next-auth'
import { GET } from '@/app/api/uploads/[...path]/route'

function makeRequest() {
  return {} as any
}

function callRoute(segments: string[]) {
  return GET(makeRequest(), { params: Promise.resolve({ path: segments }) })
}

describe('GET /api/uploads/[...path]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('exige sesión para un prefijo privado (news/...)', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const res = await callRoute(['news', 'n1', 'x.pdf'])

    expect(res.status).toBe(401)
  })

  it('sirve un prefijo público (landing/...) sin sesión', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const res = await callRoute(['landing', 'logo.png'])

    expect(res.status).toBe(200)
  })

  it('sirve un prefijo privado con sesión válida', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })

    const res = await callRoute(['tickets', 't1', 'a.pdf'])

    expect(res.status).toBe(200)
  })

  it('rechaza path traversal (..) sin importar la sesión', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })

    const res = await callRoute(['..', '..', 'etc', 'passwd'])

    expect(res.status).toBe(404)
  })
})
