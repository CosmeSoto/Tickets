/**
 * POST /api/admin/forms/[id]/attachments
 *
 * Bug real: se borraban los adjuntos previos uno por uno con
 * `FileService.deleteFormFile` y luego se subía el nuevo, sin transacción.
 * Dos subidas concurrentes del mismo documento podían dejar
 * `forms.fileUrl/fileSize/fileType` desincronizado de lo que realmente hay
 * en `form_attachments`, o pisarse los `form_attachments` entre sí.
 *
 * El fix envuelve el borrado de las filas viejas + la creación de la nueva +
 * el update de `forms` en un único `$transaction` — un fallo a mitad
 * revierte todo en vez de dejar un estado a medio camino.
 */

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/forms/forms-access', () => ({
  assertCanManageForms: jest.fn().mockResolvedValue(null),
  assertCanModifyForm: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/forms/form-visibility', () => ({
  assertCanViewForm: jest.fn().mockResolvedValue(null),
}))

const txMock = {
  form_attachments: { deleteMany: jest.fn(), create: jest.fn() },
  forms: { update: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn() },
    forms: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
  prisma: {
    users: { findUnique: jest.fn() },
    forms: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/services/file-service', () => ({
  FileService: {
    prepareFormFileUpload: jest.fn(),
    deletePhysicalFiles: jest.fn().mockResolvedValue(undefined),
    getFilesByForm: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { FileService } from '@/lib/services/file-service'
import { POST } from '@/app/api/admin/forms/[id]/attachments/route'

const FORM_ID = 'form-1'

function params() {
  return { params: Promise.resolve({ id: FORM_ID }) }
}

function makeRequest(withFile = true) {
  const formData = new Map<string, unknown>()
  if (withFile) {
    formData.set(
      'file',
      new File([new Uint8Array([1, 2, 3])], 'x.pdf', { type: 'application/pdf' })
    )
  }
  return {
    formData: async () => ({ get: (k: string) => formData.get(k) ?? null }),
  } as any
}

describe('POST /api/admin/forms/[id]/attachments', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ isSuperAdmin: true })
    ;(FileService.prepareFormFileUpload as jest.Mock).mockResolvedValue({
      filename: 'new.pdf',
      originalName: 'informe.pdf',
      mimeType: 'application/pdf',
      size: 123,
      path: '/uploads/forms/form-1/new.pdf',
    })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(txMock))
    txMock.form_attachments.deleteMany.mockResolvedValue({ count: 1 })
    txMock.form_attachments.create.mockImplementation(({ data }: any) => data)
    txMock.forms.update.mockResolvedValue({})
  })

  it('borra las filas viejas, crea la nueva y actualiza forms dentro de la MISMA transacción', async () => {
    ;(prisma.forms.findUnique as jest.Mock).mockResolvedValue({
      id: FORM_ID,
      form_attachments: [{ id: 'old-1', path: '/uploads/forms/form-1/old.pdf' }],
    })

    const res: any = await POST(makeRequest(), params())

    expect(res.status).toBe(201)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(txMock.form_attachments.deleteMany).toHaveBeenCalledWith({ where: { formId: FORM_ID } })
    expect(txMock.form_attachments.create).toHaveBeenCalled()
    expect(txMock.forms.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fileType: 'application/pdf' }) })
    )
    // El borrado físico del archivo viejo ocurre DESPUÉS de que la transacción confirme
    expect(FileService.deletePhysicalFiles).toHaveBeenCalledWith(['/uploads/forms/form-1/old.pdf'])
  })

  it('si la transacción falla (p. ej. el update de forms), no queda ningún efecto parcial ni se limpia el archivo viejo', async () => {
    ;(prisma.forms.findUnique as jest.Mock).mockResolvedValue({
      id: FORM_ID,
      form_attachments: [{ id: 'old-1', path: '/uploads/forms/form-1/old.pdf' }],
    })
    ;(prisma.$transaction as jest.Mock).mockRejectedValue(new Error('fallo de BD a mitad'))

    const res: any = await POST(makeRequest(), params())

    expect(res.status).toBe(500)
    expect(FileService.deletePhysicalFiles).not.toHaveBeenCalled()
  })

  it('sin adjuntos previos: no intenta borrar nada del disco', async () => {
    ;(prisma.forms.findUnique as jest.Mock).mockResolvedValue({
      id: FORM_ID,
      form_attachments: [],
    })

    const res: any = await POST(makeRequest(), params())

    expect(res.status).toBe(201)
    expect(FileService.deletePhysicalFiles).toHaveBeenCalledWith([])
  })
})
