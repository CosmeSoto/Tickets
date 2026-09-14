/**
 * GET /api/technicians/simulate-assignment
 *
 * Solo verificaba `session?.user` — sin chequeo de rol. Cualquier CLIENT o
 * TECHNICIAN autenticado podía consultar la simulación de asignación
 * (carga de trabajo y nombres de técnicos por categoría). El único
 * consumidor real es un formulario de administración de categorías, pero
 * la API no lo exigía.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/services/technician-assignment-service', () => ({
  TechnicianAssignmentService: { simulateAssignment: jest.fn() },
}))

import { getServerSession } from 'next-auth'
import { TechnicianAssignmentService } from '@/lib/services/technician-assignment-service'
import { GET } from '@/app/api/technicians/simulate-assignment/route'

function req(url: string) {
  return { url } as any
}

describe('GET /api/technicians/simulate-assignment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('regresión: un CLIENT autenticado recibe 403, no se ejecuta la simulación', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT' },
    })

    const res = await GET(
      req('http://localhost/api/technicians/simulate-assignment?categoryId=cat-1')
    )

    expect(res.status).toBe(403)
    expect(TechnicianAssignmentService.simulateAssignment).not.toHaveBeenCalled()
  })

  it('regresión: un TECHNICIAN autenticado recibe 403', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'tech-1', role: 'TECHNICIAN' },
    })

    const res = await GET(
      req('http://localhost/api/technicians/simulate-assignment?categoryId=cat-1')
    )

    expect(res.status).toBe(403)
  })

  it('un ADMIN sí puede simular la asignación', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    })
    ;(TechnicianAssignmentService.simulateAssignment as jest.Mock).mockResolvedValue({ ok: true })

    const res = await GET(
      req('http://localhost/api/technicians/simulate-assignment?categoryId=cat-1')
    )

    expect(res.status).toBe(200)
    expect(TechnicianAssignmentService.simulateAssignment).toHaveBeenCalledWith('cat-1')
  })
})
