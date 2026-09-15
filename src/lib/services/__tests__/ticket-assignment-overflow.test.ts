/**
 * AssignmentService.autoAssignTicket — desbordamiento cuando el técnico
 * preferido ya está al máximo de tickets activos.
 *
 * Bug 1 (configurado): si la categoría (o una ancestro) tiene un técnico
 * configurado a mano en `technician_assignments` pero está al máximo, el
 * código tiraba un throw inmediato ("No hay técnico disponible...") y
 * dejaba el ticket sin asignar — sin intentar nunca el resto del
 * departamento ni un admin de la familia, aunque sí hubiera alguien con
 * capacidad. Fix: cuando el técnico configurado no tiene capacidad, se cae
 * al flujo general (departamento → admin de familia), igual que cuando la
 * categoría no tiene ningún técnico configurado.
 *
 * Bug 2 (flujo general): el filtro por departamento (`techsFromDept.length
 * > 0 ? ...`) solo miraba si existía UN match de departamento, sin
 * importar si ese técnico ya estaba al máximo — la carga solo bajaba el
 * score (30% del peso), sin excluirlo. Si el departamento tenía un único
 * técnico y estaba lleno, se le asignaba de todas formas en vez de pasar
 * al admin de la familia. Fix: el filtro de departamento ahora exige
 * capacidad real; si nadie del departamento la tiene, cae al admin de la
 * familia con capacidad antes de rendirse.
 *
 * Ambos casos comparten el mismo resultado esperado: "nadie con exceso de
 * carga se queda con el ticket mientras haya alguien real con capacidad en
 * el departamento o en la familia" — y si tampoco hay nadie con capacidad
 * en ningún lado, el ticket se queda sin asignar (no se fuerza a nadie por
 * encima del máximo).
 */

const MAX_TICKETS = 10

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tickets: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    categories: {
      findUnique: jest.fn(),
    },
    technician_assignments: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    users: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    ticket_family_config: {
      findUnique: jest.fn(),
    },
    user_family_access: {
      findMany: jest.fn(),
    },
    ticket_history: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/settings/runtime-settings', () => ({
  getMaxTicketsPerUser: jest.fn().mockResolvedValue(MAX_TICKETS),
}))

jest.mock('@/lib/auth/family-scope', () => ({
  getTechnicianIdsNativeToFamily: jest.fn(),
  getAdminIdsNativeToFamily: jest.fn(),
  technicianIsNativeToFamily: jest.fn().mockResolvedValue(true),
}))

import { AssignmentService } from '../ticket-assignment.service'
import { getTechnicianIdsNativeToFamily, getAdminIdsNativeToFamily } from '@/lib/auth/family-scope'
import prisma from '@/lib/prisma'

const TICKET_ID = 'ticket-1'
const CATEGORY_ID = 'cat-1'
const DEPT_ID = 'dept-1'
const FAMILY_ID = 'family-1'
const CLIENT_ID = 'client-1'

function user(overrides: Record<string, unknown>) {
  return {
    id: 'user-x',
    name: 'User X',
    email: 'x@test.com',
    role: 'TECHNICIAN',
    departmentId: DEPT_ID,
    departments: { id: DEPT_ID, name: 'Depto', color: '#000' },
    isSuperAdmin: false,
    lastLogin: null,
    _count: { tickets_tickets_assigneeIdTousers: 0 },
    ...overrides,
  }
}

const techFull = user({
  id: 'tech-full',
  name: 'Técnico Lleno',
  _count: { tickets_tickets_assigneeIdTousers: MAX_TICKETS },
})
const techB = user({
  id: 'tech-b',
  name: 'Técnico B',
  _count: { tickets_tickets_assigneeIdTousers: 2 },
})
const adminFamily = user({
  id: 'admin-family',
  name: 'Admin Familia',
  role: 'ADMIN',
  departmentId: null,
  departments: null,
  _count: { tickets_tickets_assigneeIdTousers: 1 },
})
const adminFamilyFull = user({
  id: 'admin-family',
  name: 'Admin Familia',
  role: 'ADMIN',
  departmentId: null,
  departments: null,
  _count: { tickets_tickets_assigneeIdTousers: MAX_TICKETS },
})

describe('AssignmentService.autoAssignTicket — desbordamiento de capacidad', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue({
      id: TICKET_ID,
      categoryId: CATEGORY_ID,
      familyId: FAMILY_ID,
      clientId: CLIENT_ID,
      assigneeId: null,
      categories: {
        departmentId: DEPT_ID,
        departments: { id: DEPT_ID, name: 'Depto', color: '#000' },
      },
    })
    // Sin categoría padre: la cadena de ancestros es solo [CATEGORY_ID].
    ;(prisma.categories.findUnique as jest.Mock).mockResolvedValue({ parentId: null })
    ;(prisma.ticket_family_config.findUnique as jest.Mock).mockResolvedValue({
      autoAssignRespectsFamilies: true,
    })
    ;(prisma.user_family_access.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ lastLogin: null })
    ;(prisma.technician_assignments.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.technician_assignments.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.technician_assignments.create as jest.Mock).mockResolvedValue({})
    ;(prisma.ticket_history.create as jest.Mock).mockResolvedValue({})
    ;(prisma.tickets.update as jest.Mock).mockImplementation(
      ({ data }: { data: { assigneeId: string } }) =>
        Promise.resolve({ id: TICKET_ID, assigneeId: data.assigneeId })
    )
    ;(getTechnicianIdsNativeToFamily as jest.Mock).mockResolvedValue([techFull.id, techB.id])
    ;(getAdminIdsNativeToFamily as jest.Mock).mockResolvedValue([adminFamily.id])
  })

  it('el técnico CONFIGURADO para la categoría está lleno → cae al resto del departamento (no se queda sin asignar)', async () => {
    ;(prisma.technician_assignments.findMany as jest.Mock).mockResolvedValue([
      {
        priority: 1,
        maxTickets: null,
        users: { ...techFull, _count: techFull._count },
        categories: { name: 'Categoría' },
      },
    ])
    ;(prisma.users.findMany as jest.Mock).mockResolvedValue([techFull, techB, adminFamily])

    const result = await AssignmentService.autoAssignTicket(TICKET_ID, {}, undefined, {
      skipNotifications: true,
    })

    expect(result.assignedTechnician.id).toBe(techB.id)
  })

  it('sin técnico configurado, el único técnico del departamento está lleno → cae al admin de la familia (no se sobrecarga al técnico)', async () => {
    ;(prisma.technician_assignments.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.users.findMany as jest.Mock).mockResolvedValue([techFull, adminFamily])

    const result = await AssignmentService.autoAssignTicket(TICKET_ID, {}, undefined, {
      skipNotifications: true,
    })

    expect(result.assignedTechnician.id).toBe(adminFamily.id)
  })

  it('nadie tiene capacidad (ni departamento ni admins de familia) → el ticket queda sin asignar, no se fuerza a nadie', async () => {
    ;(prisma.technician_assignments.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.users.findMany as jest.Mock).mockResolvedValue([techFull, adminFamilyFull])

    await expect(
      AssignmentService.autoAssignTicket(TICKET_ID, {}, undefined, { skipNotifications: true })
    ).rejects.toThrow()

    expect(prisma.tickets.update).not.toHaveBeenCalled()
  })
})
