/**
 * POST /api/planner/reports/run
 * Reporte de cumplimiento de Tareas — por técnico, por área, cumplidas vs.
 * pendientes/vencidas y por origen (ticket vs. independiente), con rango de
 * fechas día/semana/mes/personalizado (o sin filtro, sin tope de antigüedad,
 * salvo la paginación de la vista JSON). `format` decide la respuesta:
 * 'json' (tabla paginada + resumen), 'csv' o 'pdf' (el listado completo).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assertCanViewPlanner, getPlannerAccess } from '@/lib/planner/access'
import {
  runTaskReport,
  summarizeTaskReport,
  type TaskReportFilters,
} from '@/lib/planner/reports/run-task-report'
import { toCSV } from '@/lib/inventory/report-format'
import { generateReportPDF } from '@/lib/inventory/report-utils'
import { getSystemBranding } from '@/lib/branding'

const ORIGIN_LABEL: Record<string, string> = { ticket: 'Ticket', personal: 'Independiente' }
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completada',
  blocked: 'Bloqueada',
}

function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const denied = await assertCanViewPlanner(session.user.id, session.user.role)
  if (denied) return denied

  const access = await getPlannerAccess(session.user.id, session.user.role)
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  const canFilterByTechnician = access.canManage || session.user.role === 'ADMIN' || isSuperAdmin
  const restrictToOwnTickets = !isSuperAdmin && session.user.role !== 'ADMIN'

  const body = await request.json().catch(() => ({}))
  const filters: TaskReportFilters = {
    from: body.from || undefined,
    to: body.to || undefined,
    origin: body.origin || 'all',
    status: body.status || 'all',
    familyId: body.familyId || 'all',
    userId: body.userId || 'all',
  }
  const format: 'json' | 'csv' | 'pdf' = body.format || 'json'
  const page = Math.max(1, Number(body.page) || 1)
  const pageSize = Math.min(200, Math.max(1, Number(body.pageSize) || 25))

  const rows = await runTaskReport(
    session.user.id,
    access,
    canFilterByTechnician,
    filters,
    restrictToOwnTickets
  )

  if (format === 'json') {
    const summary = summarizeTaskReport(rows)
    const paged = rows.slice((page - 1) * pageSize, page * pageSize)
    return NextResponse.json({
      tasks: paged.map(r => ({
        id: r.id,
        origin: r.origin,
        title: r.title,
        status: r.status,
        priority: r.priority,
        dueDate: r.dueDate?.toISOString() ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
        assigneeName: r.assigneeName,
        familyName: r.familyName,
        ticketTitle: r.ticketTitle,
      })),
      total: rows.length,
      page,
      pageSize,
      summary,
    })
  }

  const csvRows = rows.map(r => ({
    Título: r.title,
    Origen: ORIGIN_LABEL[r.origin],
    Estado: STATUS_LABEL[r.status] ?? r.status,
    Prioridad: r.priority,
    'Fecha límite': fmtDate(r.dueDate),
    Completada: fmtDate(r.completedAt),
    Responsable: r.assigneeName ?? 'Sin asignar',
    Área: r.familyName ?? 'Sin área',
    Ticket: r.ticketTitle ?? '—',
  }))

  if (format === 'csv') {
    return new NextResponse(toCSV(csvRows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="reporte-tareas.csv"',
      },
    })
  }

  const summary = summarizeTaskReport(rows)
  const branding = await getSystemBranding()
  const pdfBuffer = await generateReportPDF(
    'Reporte de Tareas',
    [
      { title: 'Total', value: summary.total, description: 'tareas en el rango filtrado' },
      {
        title: 'Vencidas',
        value: summary.overdueCount,
        description: 'pendientes con fecha límite superada',
      },
      ...summary.byStatus.map(s => ({
        title: STATUS_LABEL[s.status] ?? s.status,
        value: s.count,
        description: 'tareas',
      })),
    ],
    ['Título', 'Origen', 'Estado', 'Fecha límite', 'Responsable', 'Área'],
    rows.map(r => [
      r.title,
      ORIGIN_LABEL[r.origin],
      STATUS_LABEL[r.status] ?? r.status,
      fmtDate(r.dueDate),
      r.assigneeName ?? 'Sin asignar',
      r.familyName ?? 'Sin área',
    ]),
    {
      companyName: branding.companyName,
      logoUrl: branding.logoUrl,
      logoDarkUrl: branding.logoDarkUrl,
    }
  )

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="reporte-tareas.pdf"',
    },
  })
}
