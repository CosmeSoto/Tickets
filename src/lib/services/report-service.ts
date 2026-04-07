import prisma from '@/lib/prisma'

export interface ReportFilters {
  startDate?: Date
  endDate?: Date
  status?: string
  priority?: string
  categoryId?: string
  assigneeId?: string
  clientId?: string
  departmentId?: string
}

export interface TicketReport {
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  resolvedTickets: number
  closedTickets: number
  avgResolutionTime: string
  ticketsByPriority: Record<string, number>
  ticketsByCategory: Array<{
    categoryName: string
    count: number
    percentage: number
  }>
  ticketsByStatus: Record<string, number>
  dailyTickets: Array<{
    date: string
    created: number
    resolved: number
  }>
  // Métricas de SLA agregadas
  slaMetrics: {
    totalWithSLA: number
    slaCompliant: number
    slaBreached: number
    slaComplianceRate: number
    avgSlaResponseTime: string
    criticalSlaBreaches: number
    upcomingSlaDeadlines: number
    slaByPriority: Record<string, {
      total: number
      compliant: number
      breached: number
      complianceRate: number
    }>
  }
  detailedTickets?: Array<{
    id: string
    title: string
    description: string
    status: string
    priority: string
    createdAt: string
    updatedAt: string
    resolvedAt: string | null
    resolutionTime: string | null
    firstResponseAt: string | null
    slaDeadline: string | null
    slaStatus: 'COMPLIANT' | 'BREACHED' | 'AT_RISK' | 'NO_SLA'
    slaTimeRemaining: string | null
    slaResponseTime: string | null
    // Métricas SLA detalladas de la base de datos
    slaMetrics?: {
      policyName: string | null
      responseDeadline: string | null
      resolutionDeadline: string | null
      responseSLAMet: boolean | null
      resolutionSLAMet: boolean | null
      responseTimeMinutes: number | null
      resolutionTimeMinutes: number | null
      hasViolations: boolean
      violationsCount: number
    }
    estimatedTime: number | null
    actualTime: number | null
    source: string
    tags: string[]
    client: {
      id: string
      name: string
      email: string
    }
    assignee: {
      id: string
      name: string
      email: string
    } | null
    category: {
      id: string
      name: string
      color: string
    }
    department: {
      id: string
      name: string
    } | null
    rating: {
      score: number
      comment: string | null
    } | null
    commentsCount: number
    attachmentsCount: number
  }>
  // Metadatos para control de volumen
  metadata?: {
    totalRecords: number
    returnedRecords: number
    limitApplied: number
    wasLimited: boolean
    hasMoreRecords: boolean
    filtersApplied: boolean
  }
}

export interface TechnicianReport {
  technicianId: string
  technicianName: string
  email: string
  phone?: string
  department: string | null
  totalAssigned: number
  resolved: number
  inProgress: number
  avgResolutionTime: string
  resolutionRate: number
  workload: 'Baja' | 'Media' | 'Alta' | 'Sobrecargado'
  ticketsToday: number
  ticketsThisWeek: number
  ticketsThisMonth: number
  averageRating: number | null
  isActive: boolean
  createdAt?: string
  lastLogin?: string
  maxCapacity?: number
  avgFirstResponseTime?: string
  avgResponseTimeRating?: number
  avgTechnicalSkillRating?: number
  avgCommunicationRating?: number
  avgProblemResolutionRating?: number
  totalRatings?: number
  assignedCategories?: string
  avgIdleTime?: string
  // Métricas de SLA agregadas
  slaMetrics: {
    totalWithSLA: number
    slaCompliant: number
    slaBreached: number
    slaComplianceRate: number
    avgSlaResponseTime: string
    criticalSlaBreaches: number
    upcomingSlaDeadlines: number
  }
}

export interface CategoryReport {
  categoryId: string
  categoryName: string
  description: string | null
  department: string | null
  level: number
  parentCategory: string | null
  totalTickets: number
  resolvedTickets: number
  avgResolutionTime: string
  resolutionRate: number
  averagePriority: string
  topTechnicians: Array<{
    name: string
    resolved: number
  }>
  isActive: boolean
}

export class ReportService {
  /**
   * Genera reporte completo de tickets con filtros aplicados correctamente y límites de seguridad
   */
  static async generateTicketReport(filters: ReportFilters = {}, options: { limit?: number } = {}): Promise<TicketReport> {
    const { limit = 5000 } = options // Límite por defecto de 5000 registros
    const where = this.buildWhereClause(filters)

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      ticketsByPriority,
      ticketsByCategory,
      ticketsByStatus,
      dailyTickets,
      avgResolutionTime,
      detailedTicketsResult,
      slaMetrics,
    ] = await Promise.all([
      prisma.tickets.count({ where }),
      prisma.tickets.count({ where: { ...where, status: 'OPEN' } }),
      prisma.tickets.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.tickets.count({ where: { ...where, status: 'RESOLVED' } }),
      prisma.tickets.count({ where: { ...where, status: 'CLOSED' } }),
      this.getTicketsByPriority(where),
      this.getTicketsByCategory(where),
      this.getTicketsByStatus(where),
      this.getDailyTickets(filters),
      this.calculateAverageResolutionTime(where),
      this.getDetailedTickets(where, limit),
      this.calculateSLAMetrics(where),
    ])

    const result: TicketReport = {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      avgResolutionTime,
      ticketsByPriority,
      ticketsByCategory,
      ticketsByStatus,
      dailyTickets,
      detailedTickets: detailedTicketsResult.tickets,
      slaMetrics,
      // Metadatos de paginación y límites
      metadata: detailedTicketsResult.metadata
    }

    return result
  }

  /**
   * Genera reporte de técnicos con métricas completas y límites de seguridad
   */
  static async generateTechnicianReport(filters: ReportFilters = {}, options: { limit?: number } = {}): Promise<TechnicianReport[]> {
    const { limit = 1000 } = options // Límite por defecto de 1000 técnicos
    
    const technicians = await prisma.users.findMany({
      where: {
        role: 'TECHNICIAN',
        isActive: true,
        ...(filters.departmentId && { departmentId: filters.departmentId })
      },
      include: {
        departments: true
      },
      take: limit // Aplicar límite
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`👥 ReportService - Procesando ${technicians.length} técnicos (límite: ${limit})`)
    }

    const reports: TechnicianReport[] = []
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    for (const technician of technicians) {
      const baseWhere = {
        ...this.buildWhereClause(filters),
        assigneeId: technician.id,
      }

      const [
        totalAssigned,
        resolved,
        inProgress,
        avgResolutionTime,
        ticketsToday,
        ticketsThisWeek,
        ticketsThisMonth,
        averageRating,
        slaMetrics
      ] = await Promise.all([
        prisma.tickets.count({ where: baseWhere }),
        prisma.tickets.count({ where: { ...baseWhere, status: 'RESOLVED' } }),
        prisma.tickets.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
        this.calculateAverageResolutionTime(baseWhere),
        prisma.tickets.count({ 
          where: { 
            assigneeId: technician.id,
            createdAt: { gte: today }
          } 
        }),
        prisma.tickets.count({ 
          where: { 
            assigneeId: technician.id,
            createdAt: { gte: thisWeek }
          } 
        }),
        prisma.tickets.count({ 
          where: { 
            assigneeId: technician.id,
            createdAt: { gte: thisMonth }
          } 
        }),
        this.calculateAverageRating(technician.id),
        this.calculateTechnicianSLAMetrics(technician.id, filters)
      ])

      const resolutionRate = totalAssigned > 0 ? (resolved / totalAssigned) * 100 : 0
      const workload = this.getWorkloadLevel(inProgress)

      reports.push({
        technicianId: technician.id,
        technicianName: technician.name,
        email: technician.email,
        department: technician.departments?.name || null,
        totalAssigned,
        resolved,
        inProgress,
        avgResolutionTime,
        resolutionRate,
        workload,
        ticketsToday,
        ticketsThisWeek,
        ticketsThisMonth,
        averageRating,
        isActive: technician.isActive,
        slaMetrics
      })
    }

    return reports.sort((a, b) => b.resolved - a.resolved)
  }

  /**
   * Genera reporte de categorías con análisis completo y límites de seguridad
   */
  static async generateCategoryReport(filters: ReportFilters = {}, options: { limit?: number } = {}): Promise<CategoryReport[]> {
    const { limit = 500 } = options // Límite por defecto de 500 categorías
    
    const categories = await prisma.categories.findMany({
      where: { 
        isActive: true,
        ...(filters.departmentId && { departmentId: filters.departmentId })
      },
      include: {
        departments: true,
        categories: true // categoría padre
      },
      take: limit // Aplicar límite
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`📂 ReportService - Procesando ${categories.length} categorías (límite: ${limit})`)
    }

    const reports: CategoryReport[] = []

    for (const category of categories) {
      const baseWhere = {
        ...this.buildWhereClause(filters),
        categoryId: category.id,
      }

      const [
        totalTickets,
        resolvedTickets,
        avgResolutionTime,
        topTechnicians,
        averagePriority
      ] = await Promise.all([
        prisma.tickets.count({ where: baseWhere }),
        prisma.tickets.count({ where: { ...baseWhere, status: 'RESOLVED' } }),
        this.calculateAverageResolutionTime(baseWhere),
        this.getTopTechniciansByCategory(category.id, filters),
        this.calculateAveragePriority(baseWhere)
      ])

      const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0

      reports.push({
        categoryId: category.id,
        categoryName: category.name,
        description: category.description,
        department: category.departments?.name || null,
        level: category.level,
        parentCategory: category.categories?.name || null,
        totalTickets,
        resolvedTickets,
        avgResolutionTime,
        resolutionRate,
        averagePriority,
        topTechnicians,
        isActive: category.isActive
      })
    }

    return reports.sort((a, b) => b.totalTickets - a.totalTickets)
  }

  /**
   * Genera reporte de departamentos con análisis completo
   */
  static async generateDepartmentReport(filters: ReportFilters = {}, options: { limit?: number } = {}): Promise<any[]> {
    const { limit = 100 } = options
    
    const departments = await prisma.departments.findMany({
      where: { 
        isActive: true
      },
      include: {
        categories: {
          where: { isActive: true }
        },
        users: {
          where: { 
            role: 'TECHNICIAN',
            isActive: true
          }
        }
      },
      take: limit
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`🏢 ReportService - Procesando ${departments.length} departamentos`)
    }

    const reports = []

    for (const dept of departments) {
      // Construir where clause para tickets del departamento
      const baseWhere = {
        ...this.buildWhereClause(filters),
        categories: {
          departmentId: dept.id
        }
      }

      const [
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        avgResolutionTime,
        slaMetrics
      ] = await Promise.all([
        prisma.tickets.count({ where: baseWhere }),
        prisma.tickets.count({ where: { ...baseWhere, status: 'OPEN' } }),
        prisma.tickets.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
        prisma.tickets.count({ where: { ...baseWhere, status: 'RESOLVED' } }),
        prisma.tickets.count({ where: { ...baseWhere, status: 'CLOSED' } }),
        this.calculateAverageResolutionTime(baseWhere),
        this.calculateDepartmentSLA(dept.id, filters)
      ])

      const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0

      reports.push({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        color: dept.color,
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        avgResolutionTime,
        resolutionRate,
        slaCompliance: slaMetrics.complianceRate,
        activeCategories: dept.categories.length,
        activeTechnicians: dept.users.length
      })
    }

    return reports.sort((a, b) => b.totalTickets - a.totalTickets)
  }

  /**
   * Calcula métricas SLA para un departamento
   */
  private static async calculateDepartmentSLA(departmentId: string, filters: ReportFilters) {
    const baseWhere = {
      ...this.buildWhereClause(filters),
      categories: {
        departmentId
      }
    }

    const ticketsWithSLA = await prisma.tickets.findMany({
      where: baseWhere,
      include: {
        ticket_sla_metrics: true
      }
    })

    const totalWithSLA = ticketsWithSLA.filter(t => t.ticket_sla_metrics).length
    const slaCompliant = ticketsWithSLA.filter(t => 
      t.ticket_sla_metrics && 
      t.ticket_sla_metrics.responseSLAMet !== false && 
      t.ticket_sla_metrics.resolutionSLAMet !== false
    ).length

    return {
      totalWithSLA,
      slaCompliant,
      complianceRate: totalWithSLA > 0 ? (slaCompliant / totalWithSLA) * 100 : 0
    }
  }

  /**
   * Construye cláusula WHERE validando filtros correctamente
   */
  private static buildWhereClause(filters: ReportFilters) {
    const where: any = {}

    // Filtros de fecha con validación
    if (filters.startDate || filters.endDate) {
      where.createdAt = {}
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate)
      }
      if (filters.endDate) {
        // Incluir todo el día final
        const endDate = new Date(filters.endDate)
        endDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = endDate
      }
    }

    // Filtros con validación de valores no vacíos
    if (filters.status && filters.status.trim() !== '') {
      where.status = filters.status.trim()
    }
    if (filters.priority && filters.priority.trim() !== '') {
      where.priority = filters.priority.trim()
    }
    if (filters.categoryId && filters.categoryId.trim() !== '') {
      where.categoryId = filters.categoryId.trim()
    }
    if (filters.assigneeId && filters.assigneeId.trim() !== '') {
      where.assigneeId = filters.assigneeId.trim()
    }
    if (filters.clientId && filters.clientId.trim() !== '') {
      where.clientId = filters.clientId.trim()
    }

    // Filtro por departamento (a través de categoría)
    if (filters.departmentId && filters.departmentId.trim() !== '') {
      where.categories = {
        departmentId: filters.departmentId.trim()
      }
    }

    return where
  }

  private static async getTicketsByPriority(where: any): Promise<Record<string, number>> {
    const priorities = await prisma.tickets.groupBy({
      by: ['priority'],
      where,
      _count: { priority: true },
    })

    const result: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    }

    priorities.forEach(p => {
      result[p.priority] = p._count.priority
    })

    return result
  }

  private static async getTicketsByCategory(where: any) {
    const categories = await prisma.tickets.groupBy({
      by: ['categoryId'],
      where,
      _count: { categoryId: true },
    })

    const total = categories.reduce((sum, c) => sum + c._count.categoryId, 0)

    const categoryDetails = await prisma.categories.findMany({
      where: {
        id: { in: categories.map(c => c.categoryId) },
      },
      select: { id: true, name: true },
    })

    return categories
      .map(c => {
        const category = categoryDetails.find(cat => cat.id === c.categoryId)
        return {
          categoryName: category?.name || 'Sin categoría',
          count: c._count.categoryId,
          percentage: total > 0 ? (c._count.categoryId / total) * 100 : 0,
        }
      })
      .sort((a, b) => b.count - a.count)
  }

  private static async getTicketsByStatus(where: any): Promise<Record<string, number>> {
    const statuses = await prisma.tickets.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    })

    const result: Record<string, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
      ON_HOLD: 0,
    }

    statuses.forEach(s => {
      result[s.status] = s._count.status
    })

    return result
  }

  private static async getDailyTickets(filters: ReportFilters) {
    const endDate = filters.endDate || new Date()
    const startDate = filters.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

    const tickets = await prisma.tickets.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    })

    const dailyData: Record<string, { created: number; resolved: number }> = {}

    // Inicializar todos los días
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      dailyData[dateStr] = { created: 0, resolved: 0 }
    }

    // Contar tickets creados
    tickets.forEach(ticket => {
      const dateStr = ticket.createdAt.toISOString().split('T')[0]
      if (dailyData[dateStr]) {
        dailyData[dateStr].created++
      }
    })

    // Contar tickets resueltos
    tickets.forEach(ticket => {
      if (ticket.resolvedAt) {
        const dateStr = ticket.resolvedAt.toISOString().split('T')[0]
        if (dailyData[dateStr]) {
          dailyData[dateStr].resolved++
        }
      }
    })

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      created: data.created,
      resolved: data.resolved,
    }))
  }

  private static async calculateAverageResolutionTime(where: any): Promise<string> {
    const resolvedTickets = await prisma.tickets.findMany({
      where: {
        ...where,
        status: 'RESOLVED',
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    })

    if (resolvedTickets.length === 0) return '0h'

    const totalMinutes = resolvedTickets.reduce((acc, ticket) => {
      const diff = new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()
      return acc + diff / (1000 * 60)
    }, 0)

    const avgMinutes = totalMinutes / resolvedTickets.length
    const hours = Math.floor(avgMinutes / 60)
    const minutes = Math.floor(avgMinutes % 60)

    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
  }

  /**
   * Calcula métricas completas de SLA usando datos reales de la base de datos
   * Usa ticket_sla_metrics, sla_policies y sla_violations
   */
  private static async calculateSLAMetrics(where: any) {
    const now = new Date()
    
    // Obtener todos los tickets con métricas SLA reales
    const ticketsWithSLA = await prisma.tickets.findMany({
      where,
      select: {
        id: true,
        priority: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        firstResponseAt: true,
        slaDeadline: true,
        ticket_sla_metrics: {
          select: {
            responseDeadline: true,
            resolutionDeadline: true,
            firstResponseAt: true,
            resolvedAt: true,
            responseSLAMet: true,
            resolutionSLAMet: true,
            responseTimeMinutes: true,
            resolutionTimeMinutes: true,
            sla_policy: {
              select: {
                name: true,
                responseTimeHours: true,
                resolutionTimeHours: true,
                priority: true
              }
            }
          }
        },
        sla_violations: {
          select: {
            violationType: true,
            severity: true,
            isResolved: true,
            expectedAt: true,
            actualAt: true
          }
        }
      }
    })

    // Filtrar solo tickets que tienen métricas SLA o slaDeadline
    const ticketsWithSLAData = ticketsWithSLA.filter(
      t => t.ticket_sla_metrics || t.slaDeadline
    )

    const totalWithSLA = ticketsWithSLAData.length
    let slaCompliant = 0
    let slaBreached = 0
    let criticalSlaBreaches = 0
    let upcomingSlaDeadlines = 0
    let totalResponseTime = 0
    let responseTimeCount = 0

    const slaByPriority: Record<string, { total: number; compliant: number; breached: number; complianceRate: number }> = {
      LOW: { total: 0, compliant: 0, breached: 0, complianceRate: 0 },
      MEDIUM: { total: 0, compliant: 0, breached: 0, complianceRate: 0 },
      HIGH: { total: 0, compliant: 0, breached: 0, complianceRate: 0 },
      URGENT: { total: 0, compliant: 0, breached: 0, complianceRate: 0 }
    }

    ticketsWithSLAData.forEach(ticket => {
      const priority = ticket.priority as keyof typeof slaByPriority
      slaByPriority[priority].total++

      // Usar métricas reales si existen
      if (ticket.ticket_sla_metrics) {
        const metrics = ticket.ticket_sla_metrics
        
        // Verificar cumplimiento de SLA de resolución
        if (metrics.resolutionSLAMet !== null) {
          if (metrics.resolutionSLAMet) {
            slaCompliant++
            slaByPriority[priority].compliant++
          } else {
            slaBreached++
            slaByPriority[priority].breached++
            if (priority === 'URGENT' || priority === 'HIGH') {
              criticalSlaBreaches++
            }
          }
        } else if (metrics.resolutionDeadline) {
          // Ticket aún abierto - verificar deadline
          const deadline = new Date(metrics.resolutionDeadline)
          if (now > deadline) {
            slaBreached++
            slaByPriority[priority].breached++
            if (priority === 'URGENT' || priority === 'HIGH') {
              criticalSlaBreaches++
            }
          } else {
            // Verificar si está próximo al vencimiento (próximas 4 horas)
            const timeToDeadline = deadline.getTime() - now.getTime()
            if (timeToDeadline <= 4 * 60 * 60 * 1000) {
              upcomingSlaDeadlines++
            }
          }
        }

        // Calcular tiempo de respuesta desde métricas o ticket
        const firstResponse = metrics.firstResponseAt || ticket.firstResponseAt
        if (firstResponse) {
          const responseTime = new Date(firstResponse).getTime() - new Date(ticket.createdAt).getTime()
          const responseMinutes = responseTime / (1000 * 60)
          totalResponseTime += responseMinutes
          responseTimeCount++
        }
      } else if (ticket.slaDeadline) {
        // Fallback al método anterior si no hay métricas
        const slaDeadline = new Date(ticket.slaDeadline)
        
        if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
          const resolvedAt = new Date(ticket.resolvedAt!)
          if (resolvedAt <= slaDeadline) {
            slaCompliant++
            slaByPriority[priority].compliant++
          } else {
            slaBreached++
            slaByPriority[priority].breached++
            if (priority === 'URGENT' || priority === 'HIGH') {
              criticalSlaBreaches++
            }
          }
        } else {
          if (now > slaDeadline) {
            slaBreached++
            slaByPriority[priority].breached++
            if (priority === 'URGENT' || priority === 'HIGH') {
              criticalSlaBreaches++
            }
          } else {
            const timeToDeadline = slaDeadline.getTime() - now.getTime()
            if (timeToDeadline <= 4 * 60 * 60 * 1000) {
              upcomingSlaDeadlines++
            }
          }
        }

        // Calcular tiempo de respuesta
        if (ticket.firstResponseAt) {
          const responseTime = new Date(ticket.firstResponseAt).getTime() - new Date(ticket.createdAt).getTime()
          totalResponseTime += responseTime / (1000 * 60)
          responseTimeCount++
        }
      }
    })

    // Calcular tasas de cumplimiento por prioridad
    Object.keys(slaByPriority).forEach(priority => {
      const data = slaByPriority[priority]
      data.complianceRate = data.total > 0 ? (data.compliant / data.total) * 100 : 0
    })

    const slaComplianceRate = totalWithSLA > 0 ? (slaCompliant / totalWithSLA) * 100 : 0
    const avgResponseMinutes = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0
    const avgSlaResponseTime = avgResponseMinutes > 0 
      ? avgResponseMinutes >= 60 
        ? `${Math.floor(avgResponseMinutes / 60)}h ${Math.floor(avgResponseMinutes % 60)}min`
        : `${Math.floor(avgResponseMinutes)}min`
      : '0min'

    return {
      totalWithSLA,
      slaCompliant,
      slaBreached,
      slaComplianceRate: Math.round(slaComplianceRate * 10) / 10,
      avgSlaResponseTime,
      criticalSlaBreaches,
      upcomingSlaDeadlines,
      slaByPriority
    }
  }

  private static async calculateAverageRating(technicianId: string): Promise<number | null> {
    const ratings = await prisma.ticket_ratings.findMany({
      where: {
        technicianId: technicianId
      },
      select: {
        rating: true
      }
    })

    if (ratings.length === 0) return null

    const average = ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length
    return Math.round(average * 10) / 10 // Redondear a 1 decimal
  }

  private static async calculateAveragePriority(where: any): Promise<string> {
    const tickets = await prisma.tickets.findMany({
      where,
      select: {
        priority: true
      }
    })

    if (tickets.length === 0) return 'N/A'

    const priorityValues = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 }
    const total = tickets.reduce((acc, t) => acc + (priorityValues[t.priority as keyof typeof priorityValues] || 2), 0)
    const average = total / tickets.length

    if (average <= 1.5) return 'Baja'
    if (average <= 2.5) return 'Media'
    if (average <= 3.5) return 'Alta'
    return 'Urgente'
  }

  private static async getTopTechniciansByCategory(categoryId: string, filters: ReportFilters) {
    const where = {
      ...this.buildWhereClause(filters),
      categoryId,
      status: 'RESOLVED',
    }

    const technicians = await prisma.tickets.groupBy({
      by: ['assigneeId'],
      where,
      _count: { assigneeId: true },
    })

    const technicianDetails = await prisma.users.findMany({
      where: {
        id: { in: technicians.map(t => t.assigneeId).filter(Boolean) as string[] },
      },
      select: { id: true, name: true },
    })

    return technicians
      .filter(t => t.assigneeId)
      .map(t => {
        const technician = technicianDetails.find(tech => tech.id === t.assigneeId)
        return {
          name: technician?.name || 'Desconocido',
          resolved: t._count.assigneeId,
        }
      })
      .sort((a, b) => b.resolved - a.resolved)
      .slice(0, 5)
  }


  /**
   * Calcula el estado SLA de un ticket usando métricas reales
   */
  private static calculateSLAStatus(ticket: any): 'COMPLIANT' | 'BREACHED' | 'AT_RISK' | 'NO_SLA' {
    // Priorizar métricas reales de ticket_sla_metrics
    if (ticket.ticket_sla_metrics) {
      const metrics = ticket.ticket_sla_metrics
      
      // Si ya se resolvió, usar el resultado real
      if (metrics.resolutionSLAMet !== null) {
        return metrics.resolutionSLAMet ? 'COMPLIANT' : 'BREACHED'
      }
      
      // Si está abierto, verificar deadline de resolución
      if (metrics.resolutionDeadline) {
        const now = new Date()
        const deadline = new Date(metrics.resolutionDeadline)
        
        if (now > deadline) {
          return 'BREACHED'
        } else {
          const timeToDeadline = deadline.getTime() - now.getTime()
          const hoursToDeadline = timeToDeadline / (1000 * 60 * 60)
          
          // AT_RISK si queda menos de 4 horas
          return hoursToDeadline <= 4 ? 'AT_RISK' : 'COMPLIANT'
        }
      }
    }
    
    // Fallback al método anterior con slaDeadline
    if (!ticket.slaDeadline) return 'NO_SLA'
    
    const now = new Date()
    const slaDeadline = new Date(ticket.slaDeadline)
    
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      const resolvedAt = new Date(ticket.resolvedAt!)
      return resolvedAt <= slaDeadline ? 'COMPLIANT' : 'BREACHED'
    } else {
      if (now > slaDeadline) {
        return 'BREACHED'
      } else {
        const timeToDeadline = slaDeadline.getTime() - now.getTime()
        const hoursToDeadline = timeToDeadline / (1000 * 60 * 60)
        return hoursToDeadline <= 4 ? 'AT_RISK' : 'COMPLIANT'
      }
    }
  }

  /**
   * Calcula el tiempo restante para SLA usando métricas reales
   */
  private static calculateSLATimeRemaining(ticket: any): string | null {
    // Si el ticket está cerrado, no hay tiempo restante
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      return null
    }
    
    const now = new Date()
    let deadline: Date | null = null
    
    // Priorizar deadline de métricas reales
    if (ticket.ticket_sla_metrics?.resolutionDeadline) {
      deadline = new Date(ticket.ticket_sla_metrics.resolutionDeadline)
    } else if (ticket.slaDeadline) {
      deadline = new Date(ticket.slaDeadline)
    }
    
    if (!deadline) return null
    
    const timeRemaining = deadline.getTime() - now.getTime()
    
    if (timeRemaining <= 0) {
      const overdue = Math.abs(timeRemaining)
      return `Vencido: ${this.formatDuration(overdue)}`
    }
    
    return this.formatDuration(timeRemaining)
  }

  /**
   * Formatea duración en milisegundos a string legible
   */
  private static formatDuration(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}min`
    } else {
      return `${minutes}min`
    }
  }

  private static getWorkloadLevel(activeTickets: number): 'Baja' | 'Media' | 'Alta' | 'Sobrecargado' {
    if (activeTickets <= 3) return 'Baja'
    if (activeTickets <= 6) return 'Media'
    if (activeTickets <= 10) return 'Alta'
    return 'Sobrecargado'
  }

  private static async calculateTechnicianSLAMetrics(technicianId: string, filters: ReportFilters) {
    const where = {
      ...this.buildWhereClause(filters),
      assigneeId: technicianId,
    }

    // Obtener tickets con métricas SLA reales
    const tickets = await prisma.tickets.findMany({
      where,
      select: {
        id: true,
        status: true,
        priority: true,
        createdAt: true,
        resolvedAt: true,
        firstResponseAt: true,
        slaDeadline: true,
        ticket_sla_metrics: {
          select: {
            responseDeadline: true,
            resolutionDeadline: true,
            responseSLAMet: true,
            resolutionSLAMet: true,
            responseTimeMinutes: true,
            resolutionTimeMinutes: true
          }
        },
        sla_violations: {
          where: {
            isResolved: false
          },
          select: {
            severity: true,
            violationType: true
          }
        }
      }
    })

    const now = new Date()
    let slaCompliant = 0
    let slaBreached = 0
    let criticalSlaBreaches = 0
    let upcomingSlaDeadlines = 0
    let totalResponseTime = 0
    let responseTimeCount = 0

    tickets.forEach(ticket => {
      // Usar métricas reales si existen
      if (ticket.ticket_sla_metrics) {
        const metrics = ticket.ticket_sla_metrics

        // Verificar cumplimiento de SLA de resolución
        if (metrics.resolutionSLAMet !== null) {
          if (metrics.resolutionSLAMet) {
            slaCompliant++
          } else {
            slaBreached++
            // Contar violaciones críticas
            const criticalViolations = ticket.sla_violations.filter(
              v => v.severity === 'HIGH' || v.severity === 'CRITICAL'
            )
            if (criticalViolations.length > 0) {
              criticalSlaBreaches++
            }
          }
        } else if (metrics.resolutionDeadline) {
          // Ticket aún abierto
          const deadline = new Date(metrics.resolutionDeadline)
          if (now > deadline) {
            slaBreached++
            const hoursOverdue = (now.getTime() - deadline.getTime()) / (1000 * 60 * 60)
            if (hoursOverdue > 24 || ticket.priority === 'URGENT') {
              criticalSlaBreaches++
            }
          } else {
            const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
            if (hoursRemaining <= 4 && hoursRemaining > 0) {
              upcomingSlaDeadlines++
            }
          }
        }

        // Usar tiempo de respuesta real
        if (metrics.responseTimeMinutes) {
          totalResponseTime += metrics.responseTimeMinutes * 60 * 1000 // convertir a ms
          responseTimeCount++
        }
      } else if (ticket.slaDeadline) {
        // Fallback al método anterior
        const slaDeadline = new Date(ticket.slaDeadline)

        if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
          const resolvedAt = new Date(ticket.resolvedAt!)
          if (resolvedAt <= slaDeadline) {
            slaCompliant++
          } else {
            slaBreached++
            const hoursOverdue = (resolvedAt.getTime() - slaDeadline.getTime()) / (1000 * 60 * 60)
            if (hoursOverdue > 24) {
              criticalSlaBreaches++
            }
          }
        } else {
          if (now > slaDeadline) {
            slaBreached++
            const hoursOverdue = (now.getTime() - slaDeadline.getTime()) / (1000 * 60 * 60)
            if (hoursOverdue > 24) {
              criticalSlaBreaches++
            }
          } else {
            const hoursRemaining = (slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)
            if (hoursRemaining <= 4 && hoursRemaining > 0) {
              upcomingSlaDeadlines++
            }
          }
        }

        if (ticket.firstResponseAt) {
          const responseTime = new Date(ticket.firstResponseAt).getTime() - new Date(ticket.createdAt).getTime()
          totalResponseTime += responseTime
          responseTimeCount++
        }
      }
    })

    const totalWithSLA = tickets.filter(t => t.ticket_sla_metrics || t.slaDeadline).length
    const slaComplianceRate = totalWithSLA > 0 ? (slaCompliant / totalWithSLA) * 100 : 0
    const avgSlaResponseTime = responseTimeCount > 0 
      ? this.formatDuration(totalResponseTime / responseTimeCount)
      : '0h'

    return {
      totalWithSLA,
      slaCompliant,
      slaBreached,
      slaComplianceRate: Math.round(slaComplianceRate * 10) / 10,
      avgSlaResponseTime,
      criticalSlaBreaches,
      upcomingSlaDeadlines
    }
  }

  private static async getDetailedTickets(where: any, limit: number = 5000) {
    // Verificar el conteo total primero
    const totalCount = await prisma.tickets.count({ where })
    
    // Si hay demasiados registros, aplicar límite y advertir
    const wasLimited = totalCount > limit
    if (wasLimited) {
      console.warn(`⚠️ ReportService - Limitando resultados: ${totalCount} tickets encontrados, mostrando solo ${limit}`)
    }
    
    const tickets = await prisma.tickets.findMany({
      where,
      include: {
        users_tickets_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        users_tickets_assigneeIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        categories: {
          select: {
            id: true,
            name: true,
            color: true,
            departments: {
              select: {
                id: true,
                name: true
              }
            }
          },
        },
        ticket_ratings: {
          select: {
            rating: true,
            feedback: true,
          },
        },
        ticket_sla_metrics: {
          select: {
            responseDeadline: true,
            resolutionDeadline: true,
            firstResponseAt: true,
            resolvedAt: true,
            responseSLAMet: true,
            resolutionSLAMet: true,
            responseTimeMinutes: true,
            resolutionTimeMinutes: true,
            sla_policy: {
              select: {
                name: true,
                responseTimeHours: true,
                resolutionTimeHours: true
              }
            }
          }
        },
        sla_violations: {
          where: {
            isResolved: false
          },
          select: {
            violationType: true,
            severity: true,
            expectedAt: true
          }
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit, // Límite configurable
    })

    const detailedTickets = tickets.map(ticket => {
      let resolutionTime: string | null = null
      if (ticket.resolvedAt) {
        const diff = new Date(ticket.resolvedAt).getTime() - new Date(ticket.createdAt).getTime()
        const minutes = Math.floor(diff / (1000 * 60))
        const hours = Math.floor(minutes / 60)
        const days = Math.floor(hours / 24)
        
        if (days > 0) {
          resolutionTime = `${days}d ${hours % 24}h`
        } else if (hours > 0) {
          resolutionTime = `${hours}h ${minutes % 60}min`
        } else {
          resolutionTime = `${minutes}min`
        }
      }

      // Obtener el rating (relación única)
      const rating = ticket.ticket_ratings || null

      // Construir métricas SLA detalladas si existen
      const slaMetrics = ticket.ticket_sla_metrics ? {
        policyName: ticket.ticket_sla_metrics.sla_policy?.name || null,
        responseDeadline: ticket.ticket_sla_metrics.responseDeadline?.toISOString() || null,
        resolutionDeadline: ticket.ticket_sla_metrics.resolutionDeadline?.toISOString() || null,
        responseSLAMet: ticket.ticket_sla_metrics.responseSLAMet,
        resolutionSLAMet: ticket.ticket_sla_metrics.resolutionSLAMet,
        responseTimeMinutes: ticket.ticket_sla_metrics.responseTimeMinutes,
        resolutionTimeMinutes: ticket.ticket_sla_metrics.resolutionTimeMinutes,
        hasViolations: ticket.sla_violations.length > 0,
        violationsCount: ticket.sla_violations.length
      } : undefined

      return {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description || '',
        status: ticket.status as string,
        priority: ticket.priority as string,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        resolvedAt: ticket.resolvedAt?.toISOString() || null,
        resolutionTime,
        firstResponseAt: ticket.firstResponseAt?.toISOString() || null,
        slaDeadline: ticket.slaDeadline?.toISOString() || null,
        slaStatus: this.calculateSLAStatus(ticket),
        slaTimeRemaining: this.calculateSLATimeRemaining(ticket),
        slaResponseTime: ticket.firstResponseAt 
          ? this.formatDuration(new Date(ticket.firstResponseAt).getTime() - new Date(ticket.createdAt).getTime())
          : null,
        slaMetrics, // Agregar métricas SLA detalladas
        estimatedTime: ticket.estimatedTime,
        actualTime: ticket.actualTime,
        source: ticket.source as string,
        tags: ticket.tags || [],
        client: ticket.users_tickets_clientIdTousers,
        assignee: ticket.users_tickets_assigneeIdTousers,
        category: {
          id: ticket.categories.id,
          name: ticket.categories.name,
          color: ticket.categories.color || '#3B82F6'
        },
        department: ticket.categories.departments || null,
        rating: rating ? {
          score: rating.rating,
          comment: rating.feedback
        } : null,
        commentsCount: ticket._count.comments,
        attachmentsCount: ticket._count.attachments,
      }
    })

    return {
      tickets: detailedTickets,
      metadata: {
        totalRecords: totalCount,
        returnedRecords: detailedTickets.length,
        limitApplied: limit,
        wasLimited,
        hasMoreRecords: totalCount > limit,
        filtersApplied: Object.keys(where).length > 0
      }
    }
  }
}