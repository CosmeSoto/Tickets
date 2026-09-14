/**
 * GET /api/public/equipment/[id], GET /api/public/equipment-attachments/[id]
 *
 * Endpoints públicos por diseño (verificación QR), sin ningún rate limit —
 * un scraper podía enumerar equipos por id y extraer datos de personal
 * (nombre del receptor, departamento, técnico de mantenimiento) sin freno.
 * También: una fila legacy de adjunto con mimeType `image/svg+xml` (el
 * único "image/*" que puede llevar <script>) era servible inline por el
 * endpoint de adjuntos — ahora queda excluida explícitamente.
 */

jest.mock('@/lib/rate-limit', () => ({ checkRateLimit: jest.fn() }))
jest.mock('@/lib/services/digital-signature.service', () => ({
  DigitalSignatureService: { extractIpAddress: jest.fn().mockReturnValue('1.2.3.4') },
}))
jest.mock('@/lib/prisma', () => {
  const client = {
    equipment: { findUnique: jest.fn() },
    equipment_attachments: { findUnique: jest.fn() },
  }
  return { __esModule: true, default: client, prisma: client }
})
jest.mock('fs', () => ({ existsSync: jest.fn(() => true) }))
jest.mock('fs/promises', () => ({ readFile: jest.fn().mockResolvedValue(Buffer.from('img')) }))

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number
    headers: { get: (key: string) => string | null }
    private _body: unknown
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this._body = body
      this.status = init?.status ?? 200
      const headerMap = init?.headers ?? {}
      this.headers = { get: (key: string) => headerMap[key] ?? null }
    }
    async json() {
      return this._body
    }
    static json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return new MockNextResponse(data, init)
    }
  }
  return { NextResponse: MockNextResponse }
})

import { checkRateLimit } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { GET as getEquipment } from '@/app/api/public/equipment/[id]/route'
import { GET as getAttachment } from '@/app/api/public/equipment-attachments/[id]/route'

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/public/equipment/[id] — rate limit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('regresión: por encima del límite, 429 sin consultar la base de datos', async () => {
    ;(checkRateLimit as jest.Mock).mockResolvedValue({ success: false, retryAfter: 42 })

    const res = await getEquipment({} as any, params('eq-1'))

    expect(res.status).toBe(429)
    expect(prisma.equipment.findUnique).not.toHaveBeenCalled()
  })

  it('dentro del límite, consulta normalmente', async () => {
    ;(checkRateLimit as jest.Mock).mockResolvedValue({ success: true })
    ;(prisma.equipment.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await getEquipment({} as any, params('eq-1'))

    expect(res.status).toBe(404)
    expect(prisma.equipment.findUnique).toHaveBeenCalled()
  })
})

describe('GET /api/public/equipment-attachments/[id] — rate limit + SVG excluido', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(checkRateLimit as jest.Mock).mockResolvedValue({ success: true })
  })

  it('regresión: por encima del límite, 429 sin leer disco', async () => {
    ;(checkRateLimit as jest.Mock).mockResolvedValue({ success: false, retryAfter: 42 })

    const res = await getAttachment({ url: 'http://x/1' } as any, params('att-1'))

    expect(res.status).toBe(429)
    expect(prisma.equipment_attachments.findUnique).not.toHaveBeenCalled()
  })

  it('regresión: un adjunto legacy con mimeType image/svg+xml es rechazado (403), no servido inline', async () => {
    ;(prisma.equipment_attachments.findUnique as jest.Mock).mockResolvedValue({
      id: 'att-1',
      mimeType: 'image/svg+xml',
      path: '/uploads/evil.svg',
      originalName: 'evil.svg',
      equipment: { id: 'eq-1' },
    })

    const res = await getAttachment({ url: 'http://x/1' } as any, params('att-1'))

    expect(res.status).toBe(403)
  })

  it('un adjunto image/png normal sí se sirve', async () => {
    ;(prisma.equipment_attachments.findUnique as jest.Mock).mockResolvedValue({
      id: 'att-1',
      mimeType: 'image/png',
      path: '/uploads/foto.png',
      originalName: 'foto.png',
      equipment: { id: 'eq-1' },
    })

    const res = await getAttachment({ url: 'http://x/1' } as any, params('att-1'))

    expect(res.status).toBe(200)
  })
})
