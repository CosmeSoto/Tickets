/**
 * GET /api/planner/tasks
 * Lista, en un solo array, las tareas de ticket (resolution_tasks) visibles
 * para el tablero/calendario del módulo de Tareas junto con las tareas
 * independientes (personal_tasks) del propio usuario, distinguidas por
 * `origin`. La creación de tareas de ticket sigue viviendo en
 * /api/tickets/[id]/resolution-plan/tasks; la de tareas independientes vive
 * en /api/planner/personal-tasks — esta ruta sigue siendo de solo lectura,
 * ahora agregando ambas fuentes para no duplicar la lógica de agrupar por
 * día/columna en cada componente del calendario/tablero.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertCanViewPlanner, getPlannerAccess } from '@/lib/planner/access'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const denied = await assertCanViewPlanner(session.user.id, session.user.role)
  if (denied) return denied
  const access = await getPlannerAccess(session.user.id, session.user.role)

  // La escritura (PATCH .../resolution-plan/tasks/[taskId]) solo la permite
  // assertTicketAccess a: el técnico asignado AL TICKET, un colaborador del
  // ticket, o un ADMIN con alcance de familia (ver canManageResolutionPlanTasks
  // en ticket-access.ts) — esa función solo recibe el ticket, nunca la tarea
  // puntual, así que NO alcanza con que la tarea esté asignada a este técnico
  // si no es también asignado/colaborador del ticket. El filtro de acá debe
  // calcar exactamente esa regla (no solo "assignedTo = yo") — de lo contrario
  // una tarea asignada a un técnico que no es dueño ni colaborador del ticket
  // aparecería en su tablero pero fallaría con 403 al intentar arrastrarla.
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  const restrictToOwn = session.user.role !== 'ADMIN' && !isSuperAdmin

  const tasks = await prisma.resolution_tasks.findMany({
    where: {
      plan: {
        // 'draft' queda afuera: mientras el plan no está activo, la ruta de
        // cambio de estado (PATCH .../resolution-plan/tasks/[taskId]) rechaza
        // cualquier transición ("el plan está en borrador"), igual que ya
        // hace la ficha del ticket (ver comentario en esa ruta) — mostrar acá
        // una tarjeta que no se puede arrastrar sería confuso.
        status: { in: ['active', 'completed'] },
        ticket: {
          familyId: access.familyIds ? { in: access.familyIds } : undefined,
          ...(restrictToOwn
            ? {
                OR: [
                  { assigneeId: session.user.id },
                  { ticket_collaborators: { some: { collaboratorId: session.user.id } } },
                ],
              }
            : {}),
        },
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      startTime: true,
      endTime: true,
      completedAt: true,
      assignedTo: true,
      assignee: { select: { id: true, name: true, email: true } },
      plan: {
        select: {
          id: true,
          title: true,
          ticketId: true,
          ticket: {
            select: {
              id: true,
              title: true,
              familyId: true,
              family: { select: { id: true, name: true, color: true } },
            },
          },
        },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  })

  // Las tareas independientes son siempre "las mías" — no tienen alcance por
  // familia/rol como las de ticket (ver decisión de producto: v1 es
  // estrictamente personal, sin asignación a otros usuarios).
  const personalTasks = await prisma.personal_tasks.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      startTime: true,
      endTime: true,
      completedAt: true,
      family: { select: { id: true, name: true, color: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({
    tasks: [
      ...tasks.map(t => ({
        origin: 'ticket' as const,
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        startTime: t.startTime,
        endTime: t.endTime,
        completedAt: t.completedAt?.toISOString() ?? null,
        assignee: t.assignee,
        ticketId: t.plan.ticketId,
        ticketTitle: t.plan.ticket.title,
        planTitle: t.plan.title,
        family: t.plan.ticket.family,
        // Mismo criterio global que ya gobernaba el arrastre en el tablero
        // (access.canManage) — no se restringe más de lo que ya hace hoy la
        // ruta de escritura (assertTicketAccess por ticket).
        canEdit: access.canManage,
        canDelete: access.canManage,
      })),
      ...personalTasks.map(t => ({
        origin: 'personal' as const,
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        startTime: t.startTime,
        endTime: t.endTime,
        completedAt: t.completedAt?.toISOString() ?? null,
        assignee: t.user,
        ticketId: null,
        ticketTitle: null,
        planTitle: null,
        family: t.family,
        // Siempre dueño único — sin asignación a otros en v1.
        canEdit: true,
        canDelete: true,
      })),
    ],
  })
}
