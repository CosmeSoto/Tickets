/**
 * POST /api/admin/landing-page/upload
 *
 * Dos bugs reales:
 * 1. El campo `type` del formulario (que decide el nombre de archivo en
 *    disco vía `getUploadDir`/`path.join`) no se validaba — un `type` con
 *    `../` escribía fuera de `uploads/landing` (path traversal / escritura
 *    arbitraria). Ahora se exige que sea uno de los 3 valores fijos.
 * 2. Solo se validaba `file.type` (declarado por el cliente, falsificable).
 *    Un `evil.html` declarado `image/png` pasaba tal cual. Ahora se exige
 *    contenido real (magic bytes) para raster, y para SVG se exige que
 *    parsee como SVG y se sanea con DOMPurify antes de guardar.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/auth/require-super-admin', () => ({ requireSuperAdmin: jest.fn() }))

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('fs', () => ({ existsSync: jest.fn(() => true) }))
jest.mock('@/lib/upload-path', () => ({
  getUploadDir: (...segments: string[]) => ['/uploads', ...segments].join('/'),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { system_settings: { findFirst: jest.fn().mockResolvedValue(null) } },
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
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { writeFile } from 'fs/promises'
import { POST } from '@/app/api/admin/landing-page/upload/route'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const HTML_PAYLOAD = Buffer.from('<html><script>alert(document.cookie)</script></html>')
const SVG_WITH_SCRIPT = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="5"/></svg>'
)

function makeFile(buf: Buffer, name: string, type: string): File {
  const file = new File([new Uint8Array(buf)], name, { type })
  ;(file as any).arrayBuffer = async () =>
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return file
}

function makeRequest(file: File, type: string) {
  const formData = new FormData()
  formData.set('file', file)
  formData.set('type', type)
  return { formData: async () => formData } as any
}

describe('POST /api/admin/landing-page/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'super-1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({ ok: true })
  })

  it('regresión: un `type` con path traversal es rechazado antes de escribir a disco', async () => {
    const res = await POST(
      makeRequest(makeFile(PNG_MAGIC, 'logo.png', 'image/png'), '../../../../tmp/evil')
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeTruthy()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('regresión: un HTML disfrazado de image/png es rechazado, no se escribe a disco', async () => {
    const res = await POST(makeRequest(makeFile(HTML_PAYLOAD, 'evil.png', 'image/png'), 'hero-bg'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeTruthy()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('un PNG real se acepta y se escribe dentro de uploads/landing con el `type` como prefijo', async () => {
    const res = await POST(makeRequest(makeFile(PNG_MAGIC, 'logo.png', 'image/png'), 'logo-light'))

    expect(res.status).toBe(200)
    const [filepath] = (writeFile as jest.Mock).mock.calls[0]
    expect(filepath).toEqual(expect.stringContaining('/uploads/landing/logo-light-'))
    expect(filepath).toMatch(/\.png$/)
  })

  it('regresión: un SVG con <script> se guarda saneado, sin el script', async () => {
    const res = await POST(
      makeRequest(makeFile(SVG_WITH_SCRIPT, 'logo.svg', 'image/svg+xml'), 'logo-dark')
    )

    expect(res.status).toBe(200)
    const [, savedBuffer] = (writeFile as jest.Mock).mock.calls[0]
    const savedSvg = Buffer.from(savedBuffer).toString('utf8')
    expect(savedSvg).not.toMatch(/<script/i)
    expect(savedSvg).toMatch(/<circle/)
  })

  it('un `type` fuera del enum fijo es rechazado aunque el archivo sea válido', async () => {
    const res = await POST(
      makeRequest(makeFile(PNG_MAGIC, 'logo.png', 'image/png'), 'not-a-real-type')
    )

    expect(res.status).toBe(400)
    expect(writeFile).not.toHaveBeenCalled()
  })
})
