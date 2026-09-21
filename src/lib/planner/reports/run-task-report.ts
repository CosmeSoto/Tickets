/**
 * Consulta compartida del reporte de Tareas — usada tanto para la vista JSON
 * (tabla paginada + resumen) como para la exportación CSV/PDF, para no
 * mantener dos formas de armar el mismo filtro. Combina resolution_tasks
 * (tareas de ticket) y personal_tasks (independientes) en una sola lista con
 * un discriminador `origin`, igual que GET /api/planner/tasks.
 *
 * Las tareas independientes SIEMPRE se limitan al propio usuario, sin
 * excepción por rol — es la misma regla de privacidad que ya rige el
 * tablero/calendario (v1: estrictamente personales). Si un manager filtra
 * "por técnico" a otra persona, el lado de tareas de ticket sí respeta ese
 * filtro (igual que hoy en la ficha del ticket), pero el lado de tareas
 * independientes simplemente no devuelve nada de esa otra persona.
 */
import prisma from '@/lib/prisma'
import { combineDateAndTime } from '@/lib/time-utils'
import type { PlannerAccess } from '@/lib/planner/access'

export type ReportOrigin = 'all' | 'ticket' | 'personal'
export type ReportStatusFilter =
  | 'all'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'overdue'

export interface TaskReportFilters {
  from?: string
  to?: string
  origin?: ReportOrigin
  status?: ReportStatusFilter
  familyId?: string // id concreto, 'all' o 'none'
  userId?: string // id concreto o 'all' — solo aplica al lado de ticket si el que pide no puede filtrar por técnico
}

export interface TaskReportRow {
  id: string
  origin: 'ticket' | 'personal'
  title: string
  status: string
  priority: string
  dueDate: Date | null
  completedAt: Date | null
  assigneeName: string | null
  familyName: string | null
  ticketTitle: string | null
}

export interface TaskReportSummary {
  total: number
  byStatus: { status: string; count: number }[]
  overdueCount: number
  byOrigin: { origin: string; count: number }[]
  byFamily: { familyName: string; count: number }[]
  byTechnician: { name: string; count: number }[]
}

function isOverdue(row: { status: string; dueDate: Date | null }, now: Date): boolean {
  return !!row.dueDate && row.dueDate < now && row.status !== 'completed'
}

export async function runTaskReport(
  userId: string,
  access: PlannerAccess,
  canFilterByTechnician: boolean,
  filters: TaskReportFilters,
  restrictToOwnTickets: boolean
): Promise<TaskReportRow[]> {
  const from = filters.from ? combineDateAndTime(filters.from, '00:00') : undefined
  const to = filters.to ? combineDateAndTime(filters.to, '23:59') : undefined
  const dueDateFilter = from || to ? { gte: from, lte: to } : undefined

  const effectiveTechnicianId =
    canFilterByTechnician && filters.userId && filters.userId !== 'all' ? filters.userId : undefined

  const rows: TaskReportRow[] = []

  if (filters.origin !== 'personal') {
    const ticketTasks = await prisma.resolution_tasks.findMany({
      where: {
        plan: {
          status: { in: ['active', 'completed'] },
          ticket: {
            familyId: access.familyIds ? { in: access.familyIds } : undefined,
            ...(restrictToOwnTickets
              ? {
                  OR: [
                    { assigneeId: userId },
                    { ticket_collaborators: { some: { collaboratorId: userId } } },
                  ],
                }
              : {}),
            ...(filters.familyId && filters.familyId !== 'all'
              ? { familyId: filters.familyId === 'none' ? null : filters.familyId }
              : {}),
          },
        },
        ...(dueDateFilter ? { dueDate: dueDateFilter } : {}),
        ...(filters.status && filters.status !== 'all' && filters.status !== 'overdue'
          ? { status: filters.status }
          : {}),
        ...(effectiveTechnicianId ? { assignedTo: effectiveTechnicianId } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        assignee: { select: { name: true } },
        plan: {
          select: {
            title: true,
            ticket: { select: { title: true, family: { select: { name: true } } } },
          },
        },
      },
    })

    for (const t of ticketTasks) {
      rows.push({
        id: t.id,
        origin: 'ticket',
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        assigneeName: t.assignee?.name ?? null,
        familyName: t.plan.ticket.family?.name ?? null,
        ticketTitle: t.plan.ticket.title,
      })
    }
  }

  if (filters.origin !== 'ticket') {
    // Siempre "las mías" — ver nota de privacidad en el encabezado del archivo.
    const personalTasks = await prisma.personal_tasks.findMany({
      where: {
        userId,
        ...(dueDateFilter ? { dueDate: dueDateFilter } : {}),
        ...(filters.status && filters.status !== 'all' && filters.status !== 'overdue'
          ? { status: filters.status }
          : {}),
        ...(filters.familyId && filters.familyId !== 'all'
          ? { familyId: filters.familyId === 'none' ? null : filters.familyId }
          : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        family: { select: { name: true } },
        user: { select: { name: true } },
      },
    })

    for (const t of personalTasks) {
      rows.push({
        id: t.id,
        origin: 'personal',
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        assigneeName: t.user.name,
        familyName: t.family?.name ?? null,
        ticketTitle: null,
      })
    }
  }

  const filtered = filters.status === 'overdue' ? rows.filter(r => isOverdue(r, new Date())) : rows

  filtered.sort((a, b) => {
    const at = a.dueDate?.getTime() ?? 0
    const bt = b.dueDate?.getTime() ?? 0
    return bt - at
  })

  return filtered
}

export function summarizeTaskReport(rows: TaskReportRow[]): TaskReportSummary {
  const now = new Date()
  const byStatus = new Map<string, number>()
  const byOrigin = new Map<string, number>()
  const byFamily = new Map<string, number>()
  const byTechnician = new Map<string, number>()
  let overdueCount = 0

  for (const row of rows) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1)
    byOrigin.set(row.origin, (byOrigin.get(row.origin) ?? 0) + 1)
    const familyKey = row.familyName ?? 'Sin área'
    byFamily.set(familyKey, (byFamily.get(familyKey) ?? 0) + 1)
    const techKey = row.assigneeName ?? 'Sin asignar'
    byTechnician.set(techKey, (byTechnician.get(techKey) ?? 0) + 1)
    if (isOverdue(row, now)) overdueCount++
  }

  return {
    total: rows.length,
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
    overdueCount,
    byOrigin: [...byOrigin.entries()].map(([origin, count]) => ({ origin, count })),
    byFamily: [...byFamily.entries()]
      .map(([familyName, count]) => ({ familyName, count }))
      .sort((a, b) => b.count - a.count),
    byTechnician: [...byTechnician.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  }
}
