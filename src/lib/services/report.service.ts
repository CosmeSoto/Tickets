/**
 * ReportService — Multi-familia
 * Centraliza los reportes del sistema de tickets con soporte para filtrado por familia.
 *
 * Requisitos: 4.1, 4.2, 3.4, 13.3, 16.1, 3.2, 11.4, 6.1-6.5
 */

import { prisma } from '@/lib/prisma'

export interface DateRange {
  startDate?: Date
  endDate?: Date
}

// ─────────────────────────────────────────────
// Tipos de retorno
// ─────────────────────────────────────────────

export interface FamilyExecutiveSummary {
  familyId: string
  familyName: string
  familyCode: string
  familyColor: string | null
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  resolvedTickets: number
  closedTickets: number
  avgResolutionTimeMinutes: number | null
  slaComplianceRate: number
}

export interface TechnicianPerformance {
  technicianId: string
  technicianName: string
  technicianEmail: string
  assignedTickets: number
  resolvedTickets: number
  avgResolutionTimeMinutes: number | null
  avgRating: number | null
}

export interface TemporalTrendPoint {
  period: string
  count: number
  familyId?: string
  familyName?: string
}

export interface SLAComplianceRow {
  familyId: string
  familyName: string
  priority: string
  total: number
  compliant: number
  breached: number
  complianceRate: number
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildDateFilter(dateRange?: DateRange) {
  if (!dateRange?.startDate && !dateRange?.endDate) return undefined
  const filter: { gte?: Date; lte?: Date } = {}
  if (dateRange.startDate) filter.gte = dateRange.startDate
  if (dateRange.endDate) {
    const end = new Date(dateRange.endDate)
    end.setHours(23, 59, 59, 999)
    filter.lte = end
  }
  return filter
}

function buildTicketWhere(familyId: string | 'all', dateRange?: DateRange) {
  const where: Record<string, unknown> = {}
  if (familyId !== 'all') where.familyId = familyId
  const dateFilter = buildDateFilter(dateRange)
  if (dateFilter) where.createdAt = dateFilter
  return where
}

async function calcAvgResolutionMinutes(where: Record<string, unknown>): Promise<number | null> {
  const resolved = await prisma.tickets.findMany({
    where: { ...where, status: 'RESOLVED', resolvedAt: { not: null } },
    select: { createdAt: true, resolvedAt: true },
  })
  if (resolved.length === 0) return null
  const total = resolved.reduce((acc, t) => {
    return acc + (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime())
  }, 0)
  return Math.round(total / resolved.length / 60000)
}

// ─────────────────────────────────────────────
// ReportService
// ─────────────────────────────────────────────

export class ReportService {
  /**
   * Resumen ejecutivo por familia (o todas las familias).
   * Retorna métricas de tickets y cumplimiento de SLA por familia.
   */
  static async getExecutiveSummary(
    familyId: string | 'all',
    dateRange?: DateRange
  ): Promise<FamilyExecutiveSummary[]> {
    // Obtener familias a procesar
    const families =
      familyId === 'all'
        ? await prisma.families.findMany({
            where: { isActive: true },
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
            select: { id: true, name: true, code: true, color: true },
          })
        : await prisma.families.findMany({
            where: { id: familyId },
            select: { id: true, name: true, code: true, color: true },
          })

    const results: FamilyExecutiveSummary[] = []

    for (const family of families) {
      const where = buildTicketWhere(family.id, dateRange)

      const [total, open, inProgress, resolved, closed, avgMinutes, slaData] = await Promise.all([
        prisma.tickets.count({ where }),
        prisma.tickets.count({ where: { ...where, status: 'OPEN' } }),
        prisma.tickets.count({ where: { ...where, status: 'IN_PROGRESS' } }),
        prisma.tickets.count({ where: { ...where, status: 'RESOLVED' } }),
        prisma.tickets.count({ where: { ...where, status: 'CLOSED' } }),
        calcAvgResolutionMinutes(where),
        prisma.tickets.findMany({
          where,
          include: {
            ticket_sla_metrics: { select: { resolutionSLAMet: true } },
          },
        }),
      ])

      // Calcular SLA compliance
      const withSLA = slaData.filter((t) => t.ticket_sla_metrics || t.slaDeadline)
      const now = new Date()
      let compliant = 0
      for (const t of withSLA) {
        if (t.ticket_sla_metrics?.resolutionSLAMet === true) {
          compliant++
        } else if (t.ticket_sla_metrics?.resolutionSLAMet === false) {
          // breached — no increment
        } else if (t.slaDeadline) {
          const deadline = new Date(t.slaDeadline)
          if (t.resolvedAt) {
            if (new Date(t.resolvedAt) <= deadline) compliant++
          } else if (now <= deadline) {
            compliant++
          }
        }
      }
      const slaComplianceRate =
        withSLA.length > 0 ? Math.round((compliant / withSLA.length) * 1000) / 10 : 0

      results.push({
        familyId: family.id,
        familyName: family.name,
        familyCode: family.code,
        familyColor: family.color,
        totalTickets: total,
        openTickets: open,
        inProgressTickets: inProgress,
        resolvedTickets: resolved,
        closedTickets: closed,
        avgResolutionTimeMinutes: avgMinutes,
        slaComplianceRate,
      })
    }

    return results
  }

  /**
   * Rendimiento de técnicos filtrado por familia (o todas).
   * Retorna tickets asignados/resueltos, tiempo promedio y calificación.
   */
  static async getTechnicianPerformance(
    familyId: string | 'all',
    dateRange?: DateRange
  ): Promise<TechnicianPerformance[]> {
    // Obtener técnicos según familia
    const technicianWhere: Record<string, unknown> = { role: 'TECHNICIAN', isActive: true }
    if (familyId !== 'all') {
      technicianWhere.technicianFamilyAssignments = {
        some: { familyId, isActive: true },
      }
    }

    const technicians = await prisma.users.findMany({
      where: technicianWhere,
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })

    const results: TechnicianPerformance[] = []

    for (const tech of technicians) {
      const where = { ...buildTicketWhere(familyId, dateRange), assigneeId: tech.id }

      const [assigned, resolved, avgMinutes, ratings] = await Promise.all([
        prisma.tickets.count({ where }),
        prisma.tickets.count({ where: { ...where, status: 'RESOLVED' } }),
        calcAvgResolutionMinutes(where),
        prisma.ticket_ratings.findMany({
          where: { technicianId: tech.id },
          select: { rating: true },
        }),
      ])

      const avgRating =
        ratings.length > 0
          ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / ratings.length) * 10) / 10
          : null

      results.push({
        technicianId: tech.id,
        technicianName: tech.name,
        technicianEmail: tech.email,
        assignedTickets: assigned,
        resolvedTickets: resolved,
        avgResolutionTimeMinutes: avgMinutes,
        avgRating,
      })
    }

    return results.sort((a, b) => b.resolvedTickets - a.resolvedTickets)
  }

  /**
   * Tendencias temporales de volumen de tickets agrupados por período.
   * Granularidad: 'day' | 'week' | 'month'
   */
  static async getTemporalTrends(
    familyId: string | 'all',
    granularity: 'day' | 'week' | 'month'
  ): Promise<TemporalTrendPoint[]> {
    // Rango por defecto: últimos 90 días
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const where = buildTicketWhere(familyId, { startDate, endDate })

    const tickets = await prisma.tickets.findMany({
      where,
      select: {
        createdAt: true,
        familyId: true,
        family: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const getPeriodKey = (date: Date): string => {
      if (granularity === 'day') {
        return date.toISOString().split('T')[0]
      } else if (granularity === 'week') {
        // ISO week: YYYY-Www
        const d = new Date(date)
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
        const week1 = new Date(d.getFullYear(), 0, 4)
        const weekNum =
          1 +
          Math.round(
            ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
          )
        return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
      } else {
        // month: YYYY-MM
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }
    }

    if (familyId === 'all') {
      // Agrupar por período + familia
      const map = new Map<string, TemporalTrendPoint>()
      for (const t of tickets) {
        const period = getPeriodKey(t.createdAt)
        const key = `${period}__${t.familyId ?? 'none'}`
        if (!map.has(key)) {
          map.set(key, {
            period,
            count: 0,
            familyId: t.familyId ?? undefined,
            familyName: t.family?.name ?? undefined,
          })
        }
        map.get(key)!.count++
      }
      return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period))
    } else {
      // Agrupar solo por período
      const map = new Map<string, number>()
      for (const t of tickets) {
        const period = getPeriodKey(t.createdAt)
        map.set(period, (map.get(period) ?? 0) + 1)
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, count]) => ({ period, count, familyId }))
    }
  }

  /**
   * Cumplimiento de SLA por familia y prioridad.
   */
  static async getSLACompliance(
    familyId: string | 'all',
    dateRange?: DateRange
  ): Promise<SLAComplianceRow[]> {
    const families =
      familyId === 'all'
        ? await prisma.families.findMany({
            where: { isActive: true },
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
            select: { id: true, name: true },
          })
        : await prisma.families.findMany({
            where: { id: familyId },
            select: { id: true, name: true },
          })

    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
    const results: SLAComplianceRow[] = []
    const now = new Date()

    for (const family of families) {
      for (const priority of priorities) {
        const where = {
          ...buildTicketWhere(family.id, dateRange),
          priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
        }

        const tickets = await prisma.tickets.findMany({
          where,
          include: {
            ticket_sla_metrics: { select: { resolutionSLAMet: true } },
          },
        })

        const withSLA = tickets.filter((t) => t.ticket_sla_metrics || t.slaDeadline)
        let compliant = 0
        let breached = 0

        for (const t of withSLA) {
          if (t.ticket_sla_metrics?.resolutionSLAMet === true) {
            compliant++
          } else if (t.ticket_sla_metrics?.resolutionSLAMet === false) {
            breached++
          } else if (t.slaDeadline) {
            const deadline = new Date(t.slaDeadline)
            if (t.resolvedAt) {
              if (new Date(t.resolvedAt) <= deadline) compliant++
              else breached++
            } else {
              if (now > deadline) breached++
              else compliant++
            }
          }
        }

        const total = withSLA.length
        const complianceRate = total > 0 ? Math.round((compliant / total) * 1000) / 10 : 0

        results.push({
          familyId: family.id,
          familyName: family.name,
          priority,
          total,
          compliant,
          breached,
          complianceRate,
        })
      }
    }

    return results
  }
}
