/**
 * POST /api/access-passes/[id]/photo
 *
 * Dos bugs reales: (1) al reemplazar la foto de una persona, la anterior
 * nunca se borraba del disco (fuga de archivos huérfanos); (2) el `update`
 * final era incondicional, así que dos subidas casi simultáneas para el
 * mismo `access_subject` podían pisarse (la última en escribir en la base
 * de datos "gana" mientras ambos archivos quedan en disco). El fix guarda el
 * archivo nuevo primero, hace un swap atómico (`updateMany` con el
 * `photoPath` leído como token optimista) y solo borra el anterior después
 * de un swap exitoso — nunca antes, para no dejar el puntero apuntando a un
 * archivo ya borrado si algo falla en el medio.
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
    users: { findUnique: jest.fn() },
    access_passes: { findUnique: jest.fn() },
    access_subjects: { updateMany: jest.fn() },
  },
}))

jest.mock('@/lib/services/security-config-service', () => ({
  SecurityConfigService: {
    validatePersonalImageSize: jest.fn().mockResolvedValue({ valid: true }),
  },
}))

jest.mock('@/lib/upload-path', () => ({
  getUploadDir: jest.fn(() => '/uploads'),
}))

jest.mock('@/lib/access/access-photo-storage', () => ({
  removeStoredAccessPhoto: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
}))

jest.mock('sharp', () => {
  const chain = {
    rotate: () => chain,
    resize: () => chain,
    jpeg: () => chain,
    toBuffer: () => Promise.resolve(Buffer.from('processed')),
  }
  return jest.fn(() => chain)
})

jest.mock('next/server', () => ({
  NextResponse: class {
    body: unknown
    status: number
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body
      this.status = init?.status ?? 200
    }
    static json(data: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => data }
    }
  },
  NextRequest: class {},
}))

import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { removeStoredAccessPhoto } from '@/lib/access/access-photo-storage'
import { POST } from '@/app/api/access-passes/[id]/photo/route'

const PASS_ID = 'pass-1'
const SUBJECT_ID = 'subject-1'
const ADMIN_ID = 'admin-1'

// JPEG magic bytes seguidos de contenido dummy — el detector de mime solo mira los primeros bytes.
const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0])

function makeRequestWithPhoto() {
  const form = new FormData()
  const file = new File([FAKE_JPEG], 'photo.jpg', { type: 'image/jpeg' })
  // jsdom no implementa File.arrayBuffer() en este entorno de test.
  ;(file as any).arrayBuffer = async () =>
    FAKE_JPEG.buffer.slice(FAKE_JPEG.byteOffset, FAKE_JPEG.byteOffset + FAKE_JPEG.byteLength)
  form.set('photo', file)
  return { formData: async () => form } as any
}

function basePass(overrides: Record<string, unknown> = {}) {
  return {
    id: PASS_ID,
    familyId: 'family-1',
    subject: { id: SUBJECT_ID, photoPath: '/uploads/access-subjects/subject-1/old.jpg' },
    ...overrides,
  }
}

describe('POST /api/access-passes/[id]/photo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: ADMIN_ID, role: 'ADMIN' } })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      isActive: true,
      isSuperAdmin: true,
      role: 'ADMIN',
      accessEnabled: true,
      canManageAccess: true,
    })
  })

  it('claim perdido (count: 0): borra el archivo nuevo y responde 409, sin tocar el anterior', async () => {
    ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(basePass())
    ;(prisma.access_subjects.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await POST(makeRequestWithPhoto(), { params: Promise.resolve({ id: PASS_ID }) })

    expect(res.status).toBe(409)
    expect(removeStoredAccessPhoto).toHaveBeenCalledTimes(1)
    // El único borrado fue el archivo recién escrito (empieza distinto del "old.jpg" original).
    expect(removeStoredAccessPhoto).not.toHaveBeenCalledWith(
      '/uploads/access-subjects/subject-1/old.jpg'
    )
  })

  it('camino feliz: swap exitoso borra la foto anterior después de escribir la nueva', async () => {
    ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(basePass())
    ;(prisma.access_subjects.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    const res = await POST(makeRequestWithPhoto(), { params: Promise.resolve({ id: PASS_ID }) })

    expect(res.status).toBe(200)
    expect(prisma.access_subjects.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SUBJECT_ID, photoPath: '/uploads/access-subjects/subject-1/old.jpg' },
      })
    )
    expect(removeStoredAccessPhoto).toHaveBeenCalledWith(
      '/uploads/access-subjects/subject-1/old.jpg'
    )
  })

  it('primera foto (photoPath null): el where usa null y el swap funciona igual', async () => {
    ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(
      basePass({ subject: { id: SUBJECT_ID, photoPath: null } })
    )
    ;(prisma.access_subjects.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    const res = await POST(makeRequestWithPhoto(), { params: Promise.resolve({ id: PASS_ID }) })

    expect(res.status).toBe(200)
    expect(prisma.access_subjects.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SUBJECT_ID, photoPath: null } })
    )
  })
})
