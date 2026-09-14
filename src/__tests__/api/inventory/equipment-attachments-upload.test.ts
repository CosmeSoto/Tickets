/**
 * POST /api/inventory/equipment/[id]/attachments
 *
 * Dos bugs reales:
 * 1. Solo `canManageInventory` (permiso GLOBAL) protegía la subida — un
 *    gestor de la familia "Vehículos" podía subir adjuntos a equipos de
 *    "TI" que no administra.
 * 2. El tipo de archivo solo se validaba por contenido real (sharp) para
 *    IMÁGENES; para PDF/Word/Excel/txt se confiaba ciegamente en el
 *    Content-Type declarado por el cliente y en la extensión del nombre de
 *    archivo — mismo patrón ya corregido en Noticias/Documentos/Tickets/
 *    Usuarios esta sesión.
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
    equipment: { findUnique: jest.fn() },
    equipment_attachments: { create: jest.fn() },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
  },
}))

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
}))

jest.mock('@/lib/upload-path', () => ({
  getUploadDir: (...segments: string[]) => ['/uploads', ...segments].join('/'),
}))

jest.mock('@/lib/services/security-config-service', () => ({
  SecurityConfigService: { validateFileSize: jest.fn().mockResolvedValue({ valid: true }) },
}))

jest.mock('@/lib/inventory/inventory-resource-access', () => ({
  assertInventoryResourceRead: jest.fn(),
  assertInventoryResourceManage: jest.fn(),
  InventoryAccessError: class InventoryAccessError extends Error {
    statusCode: number
    constructor(message: string, statusCode = 403) {
      super(message)
      this.statusCode = statusCode
    }
  },
  inventoryAccessToResponse: (err: { message: string; statusCode: number }) => ({
    status: err.statusCode,
    json: async () => ({ error: err.message }),
  }),
  toInventoryAccessUser: (u: { id: string; role: string; isSuperAdmin?: boolean }) => ({
    id: u.id,
    role: u.role,
    isSuperAdmin: u.isSuperAdmin === true,
  }),
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
import {
  assertInventoryResourceManage,
  InventoryAccessError,
} from '@/lib/inventory/inventory-resource-access'
import { POST } from '@/app/api/inventory/equipment/[id]/attachments/route'

const EQUIPMENT_ID = 'eq-1'

const PDF_MAGIC = Buffer.from('%PDF-1.4\n%rest of a real pdf...')
const HTML_PAYLOAD = Buffer.from('<html><script>alert(document.cookie)</script></html>')

function makeFile(buf: Buffer, name: string, type: string): File {
  const file = new File([new Uint8Array(buf)], name, { type })
  ;(file as any).arrayBuffer = async () =>
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return file
}

function makeRequest(file: File) {
  const formData = new FormData()
  formData.set('file', file)
  return { formData: async () => formData } as any
}

function params() {
  return { params: Promise.resolve({ id: EQUIPMENT_ID }) }
}

describe('POST /api/inventory/equipment/[id]/attachments', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'u1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(assertInventoryResourceManage as jest.Mock).mockResolvedValue(null)
    ;(prisma.equipment.findUnique as jest.Mock).mockResolvedValue({
      id: EQUIPMENT_ID,
      code: 'EQ-1',
    })
    ;(prisma.equipment_attachments.create as jest.Mock).mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data, uploader: { id: 'u1', name: 'Admin' } })
    )
  })

  it('regresión: fuera del scope de familia del equipo, 403 antes de leer el archivo', async () => {
    ;(assertInventoryResourceManage as jest.Mock).mockRejectedValue(
      new InventoryAccessError('No tienes permisos para gestionar recursos de esta familia', 403)
    )

    const res = await POST(
      makeRequest(makeFile(PDF_MAGIC, 'factura.pdf', 'application/pdf')),
      params()
    )

    expect(res.status).toBe(403)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('regresión: un HTML disfrazado de application/pdf es rechazado, no se escribe a disco', async () => {
    const file = makeFile(HTML_PAYLOAD, 'evil.pdf', 'application/pdf')

    const res = await POST(makeRequest(file), params())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeTruthy()
    expect(writeFile).not.toHaveBeenCalled()
    expect(prisma.equipment_attachments.create).not.toHaveBeenCalled()
  })

  it('un PDF real con extensión falsa (.txt) se guarda con extensión .pdf (derivada del contenido)', async () => {
    const file = makeFile(PDF_MAGIC, 'factura.txt', 'application/pdf')

    const res = await POST(makeRequest(file), params())

    expect(res.status).toBe(201)
    const [filepath] = (writeFile as jest.Mock).mock.calls[0]
    expect(filepath).toMatch(/\.pdf$/)
    const createCall = (prisma.equipment_attachments.create as jest.Mock).mock.calls[0][0].data
    expect(createCall.mimeType).toBe('application/pdf')
  })
})
