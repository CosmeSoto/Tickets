/**
 * POST /api/users/[id]/avatar
 *
 * Bug real: la validación de tipo comparaba solo `file.type` — el
 * Content-Type declarado por el cliente en el multipart, trivialmente
 * falsificable — y la extensión final en disco salía de `file.name`, también
 * controlado 100% por el cliente. Un `evil.html`/`evil.svg` declarado
 * `image/png` pasaba la validación y se guardaba con esa extensión bajo
 * `/public/uploads/avatars/`, servido estáticamente → XSS almacenada. Mismo
 * patrón ya corregido en adjuntos de tickets/noticias/documentos: usar
 * `resolveSafeUploadMime` (magic bytes) y derivar la extensión siempre de
 * `EXT_BY_MIME`, nunca del nombre del cliente.
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
    users: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
}))

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/upload-path', () => ({
  getUploadDir: (...segments: string[]) => ['/uploads', ...segments].join('/'),
}))

jest.mock('@/lib/services/security-config-service', () => ({
  SecurityConfigService: {
    validatePersonalImageSize: jest.fn().mockResolvedValue({ valid: true }),
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
import { writeFile } from 'fs/promises'
import { POST } from '@/app/api/users/[id]/avatar/route'

const USER_ID = 'user-1'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const HTML_PAYLOAD = Buffer.from('<html><script>alert(document.cookie)</script></html>')

function makeFile(buf: Buffer, name: string, type: string): File {
  const file = new File([new Uint8Array(buf)], name, { type })
  ;(file as any).arrayBuffer = async () =>
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return file
}

function makeRequest(file: File | null) {
  const formData = new FormData()
  if (file) formData.set('avatar', file)
  return { formData: async () => formData } as any
}

function params() {
  return { params: Promise.resolve({ id: USER_ID }) }
}

describe('POST /api/users/[id]/avatar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: USER_ID, role: 'CLIENT' },
    })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ id: USER_ID, avatar: null })
    ;(prisma.users.update as jest.Mock).mockResolvedValue({
      id: USER_ID,
      name: 'User',
      email: 'user@x.com',
      avatar: '/uploads/avatars/whatever.png',
    })
  })

  it('regresión: un HTML disfrazado de image/png es rechazado, no se escribe a disco', async () => {
    const file = makeFile(HTML_PAYLOAD, 'avatar.png', 'image/png')

    const res = await POST(makeRequest(file), params())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(writeFile).not.toHaveBeenCalled()
    expect(prisma.users.update).not.toHaveBeenCalled()
  })

  it('una imagen PNG real con nombre .svg se guarda con extensión .png (derivada del contenido, no del nombre)', async () => {
    const file = makeFile(PNG_MAGIC, 'avatar.svg', 'image/svg+xml')

    const res = await POST(makeRequest(file), params())

    expect(res.status).toBe(200)
    expect(writeFile).toHaveBeenCalledTimes(1)
    const [filepath] = (writeFile as jest.Mock).mock.calls[0]
    expect(filepath).toMatch(/\.png$/)
    expect(filepath).not.toMatch(/\.svg$/)
  })
})
