/**
 * GET /api/planner/tasks
 * Lista las tareas (resolution_tasks) visibles para el tablero/calendario del
 * módulo de Tareas — mismo dato que ya se ve dentro de cada ticket, agregado
 * en un solo lugar. No crea tareas nuevas (eso sigue viviendo en
 * /api/tickets/[id]/resolution-plan/tasks, dentro del ticket) — esta ruta es
 * de solo lectura para el tablero.
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
  // assertTicketAccess a: el técnico asignado al ticket, un colaborador, o un
  // ADMIN con alcance de familia (ver canManageResolutionPlanTasks en
  // ticket-access.ts) — nunca a "cualquier técnico de la familia". Mostrar acá
  // tareas de otros técnicos que después no se pueden arrastrar en el tablero
  // sería una tarjeta que parece editable pero siempre falla con 403; se
  // acota la vista a lo que ese rol realmente puede operar.
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
        ticket: access.familyIds ? { familyId: { in: access.familyIds } } : undefined,
      },
      ...(restrictToOwn
        ? {
            OR: [
              { assignedTo: session.user.id },
              { plan: { ticket: { assigneeId: session.user.id } } },
            ],
          }
        : {}),
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

  return NextResponse.json({
    tasks: tasks.map(t => ({
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
    })),
  })
}
