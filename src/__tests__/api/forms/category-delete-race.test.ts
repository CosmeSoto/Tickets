/**
 * DELETE /api/admin/form-categories/[id]
 *
 * TOCTOU real: se cuenta `_count.forms` y se borra fuera de transacción. Un
 * POST /api/admin/forms con esta categoryId puede colarse entre el conteo y
 * el delete — la FK real de Postgres (categoryId requerido, sin
 * relationMode de Prisma) ya impide la corrupción de datos, pero antes esa
 * carrera caía al catch genérico como 500 sin controlar en vez de un 400
 * limpio como el caso síncrono (con documentos ya contados).
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
    form_categories: { findUnique: jest.fn(), delete: jest.fn() },
  },
  prisma: {
    form_categories: { findUnique: jest.fn(), delete: jest.fn() },
  },
}))

jest.mock('@/lib/forms/forms-access', () => ({
  assertCanManageForms: jest.fn().mockResolvedValue(null),
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
import { prisma } from '@/lib/prisma'
import { DELETE } from '@/app/api/admin/form-categories/[id]/route'

const CATEGORY_ID = 'cat-1'

function params() {
  return { params: Promise.resolve({ id: CATEGORY_ID }) }
}

describe('DELETE /api/admin/form-categories/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
  })

  it('carrera detectada por la FK (P2003) durante el delete: 400 controlado, no 500', async () => {
    ;(prisma.form_categories.findUnique as jest.Mock).mockResolvedValue({
      id: CATEGORY_ID,
      _count: { forms: 0 }, // precheck no la detectó — se coló un create justo después
    })
    ;(prisma.form_categories.delete as jest.Mock).mockRejectedValue({ code: 'P2003' })

    const res = await DELETE({} as any, params())

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/documentos asociados/)
  })

  it('caso normal (sin carrera): con documentos ya contados, 400 sin llegar a intentar el delete', async () => {
    ;(prisma.form_categories.findUnique as jest.Mock).mockResolvedValue({
      id: CATEGORY_ID,
      _count: { forms: 3 },
    })

    const res = await DELETE({} as any, params())

    expect(res.status).toBe(400)
    expect(prisma.form_categories.delete).not.toHaveBeenCalled()
  })

  it('sin conflicto: borra y devuelve success', async () => {
    ;(prisma.form_categories.findUnique as jest.Mock).mockResolvedValue({
      id: CATEGORY_ID,
      _count: { forms: 0 },
    })
    ;(prisma.form_categories.delete as jest.Mock).mockResolvedValue({ id: CATEGORY_ID })

    const res = await DELETE({} as any, params())

    expect(res.status).toBe(200)
  })

  it('un error real de Prisma que no es P2003 sigue devolviendo 500', async () => {
    ;(prisma.form_categories.findUnique as jest.Mock).mockResolvedValue({
      id: CATEGORY_ID,
      _count: { forms: 0 },
    })
    ;(prisma.form_categories.delete as jest.Mock).mockRejectedValue(new Error('conexión perdida'))

    const res = await DELETE({} as any, params())

    expect(res.status).toBe(500)
  })
})
