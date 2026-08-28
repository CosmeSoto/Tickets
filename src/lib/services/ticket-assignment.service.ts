import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export interface AssignmentCriteria {
  categoryId?: string
  priority?: string
  workloadBalance?: boolean
  skillMatch?: boolean
}

export class AssignmentService {
  /**
   * Asigna automáticamente un ticket al técnico más apropiado.
   * @param options.skipNotifications - Si true, no envía notificaciones/emails
   *   (el caller es responsable; evita duplicados al crear ticket).
   */
  static async autoAssignTicket(
    ticketId: string,
    criteria: AssignmentCriteria = {},
    excludeUserId?: string,
    options?: { skipNotifications?: boolean }
  ) {
    try {
      // Obtener información del ticket con categoría y departamento
      const ticket = await prisma.tickets.findUnique({
        where: { id: ticketId },
        include: {
          categories: {
            include: {
              departments: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
        },
      })

      if (!ticket) {
        throw new Error('Ticket no encontrado')
      }

      // El solicitante nunca puede ser el resolutor
      const blockedUserId = excludeUserId ?? ticket.clientId

      // ─────────────────────────────────────────────────────────────────────
      // 🥇 PRIORIDAD 0: técnico configurado (`technician_assignments`,
      // autoAssign:true) en la categoría del ticket, o — si esa categoría
      // puntual no tiene ninguno configurado — en la primera categoría
      // ANCESTRO que sí tenga uno (cascada hacia niveles superiores; la UI de
      // categorías ya anuncia este comportamiento: "Sin técnicos asignados.
      // Se usará cascada inteligente hacia niveles superiores", pero antes
      // nada en este servicio lo implementaba de verdad). Ej.: un ticket cae
      // en "La Impresora no Imprime" (subcategoría sin resolutor propio) pero
      // su categoría padre "Impresión" sí tiene uno asignado — debe ganar ese
      // técnico en vez de quedar en manos del scoring general (que podía
      // terminar en alguien de otro departamento sin ninguna relación).
      // ─────────────────────────────────────────────────────────────────────
      const categoryChain = await this.buildCategoryAncestorChain(ticket.categoryId)

      let hadAnyCategoryAssignments = false
      for (const chainCategoryId of categoryChain) {
        const resolved = await this.resolveConfiguredTechnicianForCategory(
          chainCategoryId,
          ticket,
          blockedUserId
        )
        if (resolved.hadAssignments) hadAnyCategoryAssignments = true
        if (!resolved.winner) continue

        const { winner, priority } = resolved
        const reason =
          chainCategoryId === ticket.categoryId
            ? `Técnico asignado a la categoría (prioridad ${priority})`
            : `Técnico heredado de la categoría superior "${resolved.categoryName}" (prioridad ${priority})`

        const updatedTicket = await prisma.tickets.update({
          where: { id: ticketId },
          data: { assigneeId: winner.id, status: 'IN_PROGRESS' },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            users_tickets_assigneeIdTousers: { select: { id: true, name: true, email: true } },
            users_tickets_clientIdTousers: { select: { id: true, name: true, email: true } },
            categories: { select: { id: true, name: true, color: true, departmentId: true } },
          },
        })

        await prisma.ticket_history.create({
          data: {
            id: randomUUID(),
            action: ticket.assigneeId ? 'reassigned' : 'auto_assigned',
            comment: `Asignado automáticamente a ${winner.name} (${reason})`,
            ticketId,
            userId: winner.id,
            createdAt: new Date(),
          },
        })

        if (!options?.skipNotifications) {
          const { NotificationService } = await import('./notification-service')
          await NotificationService.notifyTicketAssigned(ticketId, winner.id).catch(err => {
            console.error('[AUTO-ASSIGN] Error enviando notificaciones:', err)
          })
          const { triggerTicketAssignedToTechnicianEmail, triggerTicketAssignedToClientEmail } =
            await import('@/lib/email-triggers')
          void Promise.resolve(triggerTicketAssignedToTechnicianEmail(ticketId)).catch(
            (err: Error) => console.error('[EMAIL] Error email técnico:', err)
          )
          void Promise.resolve(triggerTicketAssignedToClientEmail(ticketId)).catch((err: Error) =>
            console.error('[EMAIL] Error email cliente:', err)
          )
        }

        return {
          ticket: updatedTicket,
          assignedTechnician: { ...winner, assignmentReason: reason },
          reason,
        }
      }

      if (hadAnyCategoryAssignments) {
        // Alguna categoría de la cadena (la del ticket o alguna ancestro) SÍ
        // tiene técnicos configurados, pero ninguno pertenece al departamento
        // (o familia) correcto, o ninguno tiene capacidad. No se asigna a
        // alguien de otro departamento/familia como comodín: el ticket queda
        // sin asignar para que un Admin lo asigne manualmente (pudiendo elegir
        // de otro departamento dentro de su familia).
        throw new Error('No hay técnico disponible en el departamento de la categoría')
      }

      // ─────────────────────────────────────────────────────────────────────
      // Sin técnicos configurados en la categoría → flujo general de scoring
      // ─────────────────────────────────────────────────────────────────────

      // Obtener candidatos disponibles, excluyendo al solicitante
      let availableTechnicians = await this.getAvailableTechnicians(criteria, blockedUserId)

      if (availableTechnicians.length === 0) {
        throw new Error('No hay técnicos disponibles para este ticket')
      }

      // 🎯 PRIORIDAD 1: técnicos con familia NATIVA igual a la del ticket (si la config lo exige)
      if (ticket.familyId) {
        const familyConfig = await prisma.ticket_family_config.findUnique({
          where: { familyId: ticket.familyId },
          select: { autoAssignRespectsFamilies: true },
        })

        if (familyConfig?.autoAssignRespectsFamilies !== false) {
          const { getTechnicianIdsNativeToFamily } = await import('@/lib/auth/family-scope')
          const nativeTechIds = new Set(await getTechnicianIdsNativeToFamily(ticket.familyId))
          const techsInFamily = availableTechnicians.filter(
            t => nativeTechIds.has(t.id) || t.role === 'ADMIN'
          )
          if (techsInFamily.length > 0) {
            availableTechnicians = techsInFamily
          }
        }
      }

      // 🎯 PRIORIDAD 2: técnicos del departamento de la categoría
      // Requisito duro: si la categoría tiene departamento, SOLO un técnico de ese
      // departamento puede ganar por este camino (scoring general, categorías sin
      // technician_assignments configurados todavía). Antes era un filtro "blando"
      // (solo se aplicaba si había ≥1 candidato) y por eso, sin ningún técnico
      // configurado aún, terminaba asignando a cualquiera de la familia aunque
      // fuera de otro departamento (el bug reportado con Tania Guamán).
      //
      // 🎯 PRIORIDAD 3 (fallback dentro de este mismo bloque): si nadie del
      // departamento exacto está disponible, "el admin más cercano" —un admin
      // nativo de la FAMILIA del ticket (no necesariamente ese departamento
      // puntual)— es mejor comodín que dejar el ticket sin asignar: sigue
      // siendo alguien con responsabilidad real sobre esa área, a diferencia
      // de un técnico de otro departamento sin ninguna relación. Solo si
      // tampoco hay ningún admin de la familia, el ticket queda sin asignar
      // para que un Admin lo asigne manualmente.
      if (ticket.categories.departmentId) {
        const techsFromDept = availableTechnicians.filter(
          t => t.departmentId === ticket.categories.departmentId
        )
        if (techsFromDept.length > 0) {
          availableTechnicians = techsFromDept
        } else if (ticket.familyId) {
          const { getAdminIdsNativeToFamily } = await import('@/lib/auth/family-scope')
          const nativeAdminIds = new Set(await getAdminIdsNativeToFamily(ticket.familyId))
          const adminsInFamily = availableTechnicians.filter(t => nativeAdminIds.has(t.id))
          if (adminsInFamily.length === 0) {
            throw new Error('No hay técnico disponible en el departamento de la categoría')
          }
          availableTechnicians = adminsInFamily
        } else {
          throw new Error('No hay técnico disponible en el departamento de la categoría')
        }
      }

      // Calcular el mejor técnico
      const { getMaxTicketsPerUser } = await import('@/lib/settings/runtime-settings')
      const maxWorkloadTickets = await getMaxTicketsPerUser()
      const bestTechnician = await this.calculateBestTechnician(
        ticket,
        availableTechnicians,
        criteria,
        maxWorkloadTickets
      )

      // Asignar el ticket
      const updatedTicket = await prisma.tickets.update({
        where: { id: ticketId },
        data: {
          assigneeId: bestTechnician.id,
          status: 'IN_PROGRESS',
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          users_tickets_assigneeIdTousers: {
            select: { id: true, name: true, email: true },
          },
          users_tickets_clientIdTousers: {
            select: { id: true, name: true, email: true },
          },
          categories: {
            select: { id: true, name: true, color: true, departmentId: true },
          },
        },
      })

      // Crear entrada en el historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: ticket.assigneeId ? 'reassigned' : 'auto_assigned',
          comment: ticket.assigneeId
            ? `Ticket reasignado automáticamente a ${bestTechnician.name}`
            : `Ticket asignado automáticamente a ${bestTechnician.name}`,
          ticketId,
          userId: bestTechnician.id,
          createdAt: new Date(),
        },
      })

      // Verificar si ya existe una asignación para este técnico y categoría
      const existingAssignment = await prisma.technician_assignments.findUnique({
        where: {
          technicianId_categoryId: {
            technicianId: bestTechnician.id,
            categoryId: ticket.categoryId,
          },
        },
      })

      // Solo crear si no existe (evitar duplicados por el constraint unique)
      if (!existingAssignment) {
        await prisma.technician_assignments.create({
          data: {
            id: randomUUID(),
            technicianId: bestTechnician.id,
            categoryId: ticket.categoryId,
            priority: 5, // Prioridad media por defecto
            maxTickets: 10,
            autoAssign: true,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      }

      // Notificaciones/emails: el caller puede omitirlas (p. ej. POST /api/tickets)
      // para evitar el duplicado con el bloque de notificación post-creación.
      if (!options?.skipNotifications) {
        const { NotificationService } = await import('./notification-service')
        await NotificationService.notifyTicketAssigned(ticketId, bestTechnician.id).catch(err => {
          console.error('[AUTO-ASSIGN] Error enviando notificaciones:', err)
        })

        const { triggerTicketAssignedToTechnicianEmail, triggerTicketAssignedToClientEmail } =
          await import('@/lib/email-triggers')
        void Promise.resolve(triggerTicketAssignedToTechnicianEmail(ticketId)).catch(
          (err: Error) => {
            console.error('[EMAIL] Error enviando email de asignación a técnico:', err)
          }
        )
        void Promise.resolve(triggerTicketAssignedToClientEmail(ticketId)).catch((err: Error) => {
          console.error('[EMAIL] Error enviando email de asignación a cliente:', err)
        })
      }

      return {
        ticket: updatedTicket,
        assignedTechnician: bestTechnician,
        reason: bestTechnician.assignmentReason,
      }
    } catch (error) {
      console.error('[CRITICAL] Error en asignación automática:', error)
      throw error
    }
  }

  /**
   * Cadena de categorías desde `categoryId` (incluido, primero) hacia la
   * raíz, siguiendo `parentId`. Tope de 5 niveles (el árbol de categorías
   * tiene 4) por si algún dato quedara corrupto — nunca debería alcanzarse.
   */
  private static async buildCategoryAncestorChain(categoryId: string): Promise<string[]> {
    const chain = [categoryId]
    let currentId = categoryId
    for (let i = 0; i < 5; i++) {
      const current: { parentId: string | null } | null = await prisma.categories.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      })
      if (!current?.parentId) break
      chain.push(current.parentId)
      currentId = current.parentId
    }
    return chain
  }

  /**
   * Busca el técnico configurado (`technician_assignments`, autoAssign:true)
   * para UNA categoría puntual de la cadena — acotado siempre al departamento
   * (o familia) del TICKET real, no del nivel de la cadena que se esté
   * evaluando, para que cascadear a una categoría padre no "salte" de
   * departamento — y con capacidad disponible. También informa si la
   * categoría tenía técnicos configurados (aunque ninguno pasara el filtro),
   * para que el llamador decida si sigue cascadeando o cae al scoring general.
   */
  private static async resolveConfiguredTechnicianForCategory(
    categoryId: string,
    ticket: {
      familyId: string | null
      categories: { departmentId: string | null }
    },
    blockedUserId?: string
  ): Promise<{
    hadAssignments: boolean
    winner: {
      id: string
      name: string
      email: string
      role: string
      departmentId: string | null
    } | null
    priority: number
    categoryName: string | null
  }> {
    const categoryAssignments = await prisma.technician_assignments.findMany({
      where: {
        categoryId,
        isActive: true,
        autoAssign: true,
        users: {
          isActive: true,
          role: { in: ['TECHNICIAN', 'ADMIN'] },
          // Nunca asignar al solicitante del ticket
          id: { not: blockedUserId },
        },
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departmentId: true,
            isSuperAdmin: true,
            _count: {
              select: {
                tickets_tickets_assigneeIdTousers: {
                  where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
                },
              },
            },
          },
        },
        categories: { select: { name: true } },
      },
      orderBy: { priority: 'asc' }, // prioridad 1 = más importante
    })

    const hadAssignments = categoryAssignments.length > 0
    if (!hadAssignments) {
      return { hadAssignments, winner: null, priority: 0, categoryName: null }
    }

    // Acotar a los que pertenecen a la misma FAMILIA del ticket (nativa o
    // concedida) — no al departamento EXACTO de la categoría. Estos técnicos
    // ya fueron configurados a mano por un Admin en `technician_assignments`
    // para esta categoría (o una ancestro); ese es el fit real y confiable.
    // Exigir además que su propio `departmentId` coincida literal con el de
    // la categoría es demasiado estricto cuando el organigrama separa el
    // "departamento de dotación" del técnico (p. ej. Soporte Técnico) del
    // "departamento de categorización" de los tickets (p. ej. Tecnologías de
    // la Información) — ambos bajo la misma familia, pero con IDs distintos.
    // El filtro por departamento EXACTO sigue vivo, y a propósito, en el
    // camino de scoring GENERAL (Prioridad 2 más abajo) — ahí sí hace falta
    // porque no hay ninguna configuración explícita que respalde el encaje
    // (ahí vivía el bug original de Tania Guamán).
    //
    // Nota de diseño (2026-08-28): esto es también el mecanismo hoy vigente
    // para que un técnico dé soporte a categorías de OTRO departamento de su
    // misma familia — no hace falta "asignarle un departamento", basta con
    // agregarlo como resolutor de esas categorías puntuales desde el diálogo
    // de categoría (category-form-dialog.tsx ya pide candidatos por familia,
    // no por departamento nativo). Si en el futuro eso resulta tedioso
    // categoría por categoría, la alternativa evaluada es una tabla nueva
    // tipo `technician_department_access` (mismo patrón que
    // `user_family_access` pero a nivel de departamento) que amplíe al
    // técnico como candidato en TODAS las categorías de ese departamento
    // adicional. Tocaría 3 puntos: el filtro `categoryResolvers` en
    // src/app/api/users/route.ts, el `scoped` de aquí arriba, y el filtro
    // duro por `departmentId` de Prioridad 2 (getAvailableTechnicians /
    // más abajo en este archivo).
    let scoped = categoryAssignments
    if (ticket.familyId) {
      const { getTechnicianIdsNativeToFamily, getAdminIdsNativeToFamily } =
        await import('@/lib/auth/family-scope')
      const [nativeTechIds, nativeAdminIds, grantedAccess] = await Promise.all([
        getTechnicianIdsNativeToFamily(ticket.familyId),
        getAdminIdsNativeToFamily(ticket.familyId),
        prisma.user_family_access.findMany({
          where: { familyId: ticket.familyId, module: 'tickets', isActive: true },
          select: { userId: true },
        }),
      ])
      const eligibleIds = new Set([
        ...nativeTechIds,
        ...nativeAdminIds,
        ...grantedAccess.map(g => g.userId),
      ])
      scoped = categoryAssignments.filter(
        a => eligibleIds.has(a.users.id) || a.users.isSuperAdmin === true
      )
    } else if (ticket.categories.departmentId) {
      // Ticket sin familia (no debería pasar en la práctica) — cae al
      // departamento exacto como único criterio disponible.
      scoped = categoryAssignments.filter(
        a => a.users.departmentId === ticket.categories.departmentId
      )
    }

    // Filtrar solo los que tienen capacidad (tickets activos < maxTickets)
    const { getMaxTicketsPerUser } = await import('@/lib/settings/runtime-settings')
    const maxWorkloadTickets = await getMaxTicketsPerUser()

    const withCapacity = scoped.filter(a => {
      const active = a.users._count.tickets_tickets_assigneeIdTousers
      const cap = a.maxTickets ?? maxWorkloadTickets
      return active < cap
    })

    if (withCapacity.length === 0) {
      return { hadAssignments, winner: null, priority: 0, categoryName: null }
    }

    // Usar el de mayor prioridad (menor número) con menor carga como desempate
    const sorted = withCapacity.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      const aActive = a.users._count.tickets_tickets_assigneeIdTousers
      const bActive = b.users._count.tickets_tickets_assigneeIdTousers
      return aActive - bActive
    })

    return {
      hadAssignments,
      winner: sorted[0].users,
      priority: sorted[0].priority,
      categoryName: sorted[0].categories?.name ?? null,
    }
  }

  /**
   * Obtiene técnicos y admins disponibles para resolver tickets.
   * Excluye al solicitante (blockedUserId) para evitar auto-asignación.
   */
  private static async getAvailableTechnicians(
    criteria: AssignmentCriteria,
    blockedUserId?: string
  ) {
    const where: any = {
      role: { in: ['TECHNICIAN', 'ADMIN'] },
      isActive: true,
    }

    // Nunca incluir al solicitante del ticket
    if (blockedUserId) {
      where.id = { not: blockedUserId }
    }

    const technicians = await prisma.users.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        departments: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: {
            tickets_tickets_assigneeIdTousers: {
              where: {
                status: { in: ['OPEN', 'IN_PROGRESS'] },
              },
            },
          },
        },
      },
    })

    // Filtrar técnicos con especialización en la categoría si se especifica
    if (criteria.categoryId && criteria.skillMatch) {
      const specializedTechnicians = await prisma.technician_assignments.findMany({
        where: {
          categoryId: criteria.categoryId,
          isActive: true,
        },
        select: {
          technicianId: true,
        },
      })

      const specializedIds = specializedTechnicians.map(t => t.technicianId)

      if (specializedIds.length > 0) {
        return technicians.filter(t => specializedIds.includes(t.id))
      }
    }

    return technicians
  }

  /**
   * Calcula el mejor técnico para asignar el ticket
   */
  private static async calculateBestTechnician(
    ticket: any,
    technicians: any[],
    criteria: AssignmentCriteria,
    maxWorkloadTickets = 10
  ) {
    const scoredTechnicians = await Promise.all(
      technicians.map(async technician => {
        let score = 0
        const reasons: string[] = []

        // Factor 0: Preferir técnicos sobre admins (admins son fallback)
        if (technician.role === 'TECHNICIAN') {
          score += 0.3
          reasons.push('Técnico especializado')
        }

        // Factor 1: Familia nativa coincidente (20% del peso)
        if (ticket.familyId) {
          const { technicianIsNativeToFamily } = await import('@/lib/auth/family-scope')
          const isNative = await technicianIsNativeToFamily(technician.id, ticket.familyId)
          if (isNative) {
            score += 0.2
            reasons.push('Familia nativa del ticket')
          }
        }

        // Factor 2: Departamento coincidente (40% del peso si aplica)
        if (
          ticket.categories.departmentId &&
          technician.departmentId === ticket.categories.departmentId
        ) {
          score += 0.4
          reasons.push(`Departamento: ${technician.departments?.name}`)
        }

        // Factor 2: Carga de trabajo (30% del peso)
        if (criteria.workloadBalance !== false) {
          const workloadScore = this.calculateWorkloadScore(
            technician._count.tickets_tickets_assigneeIdTousers,
            maxWorkloadTickets
          )
          score += workloadScore * 0.3
          reasons.push(
            `Carga: ${technician._count.tickets_tickets_assigneeIdTousers} tickets activos`
          )
        }

        // Factor 3: Especialización en categoría (15% del peso)
        if (criteria.skillMatch !== false && criteria.categoryId) {
          const skillScore = await this.calculateSkillScore(technician.id, criteria.categoryId)
          score += skillScore * 0.15
          if (skillScore > 0) {
            reasons.push('Especializado en esta categoría')
          }
        }

        // Factor 4: Disponibilidad temporal (5% del peso)
        const availabilityScore = await this.calculateAvailabilityScore(technician.id)
        score += availabilityScore * 0.05
        if (availabilityScore > 0.5) {
          reasons.push('Alta disponibilidad')
        }

        return {
          ...technician,
          score,
          assignmentReason: reasons.join(', ') || 'Asignación por disponibilidad',
        }
      })
    )

    // Ordenar por puntuación y devolver el mejor
    scoredTechnicians.sort((a, b) => b.score - a.score)

    return scoredTechnicians[0]
  }

  /**
   * Calcula puntuación basada en carga de trabajo (menos carga = mayor puntuación)
   */
  private static calculateWorkloadScore(activeTickets: number, maxTickets = 10): number {
    const cap = Math.max(1, maxTickets)
    return Math.max(0, (cap - activeTickets) / cap)
  }

  /**
   * Calcula puntuación basada en especialización en categoría
   */
  private static async calculateSkillScore(
    technicianId: string,
    categoryId: string
  ): Promise<number> {
    // Verificar si tiene asignación activa en esta categoría
    const assignment = await prisma.technician_assignments.findFirst({
      where: {
        technicianId,
        categoryId,
        isActive: true,
      },
    })

    if (assignment) return 1.0

    // Verificar experiencia previa en la categoría
    const experienceCount = await prisma.tickets.count({
      where: {
        assigneeId: technicianId,
        categoryId,
        status: { in: ['RESOLVED', 'CLOSED'] },
      },
    })

    // Puntuación basada en experiencia (máximo 5 tickets para puntuación completa)
    return Math.min(1.0, experienceCount / 5)
  }

  /**
   * Calcula puntuación basada en manejo de tickets de alta prioridad
   */
  private static async calculatePriorityHandlingScore(technicianId: string): Promise<number> {
    const highPriorityResolved = await prisma.tickets.count({
      where: {
        assigneeId: technicianId,
        priority: { in: ['HIGH', 'URGENT'] },
        status: { in: ['RESOLVED', 'CLOSED'] },
      },
    })

    // Puntuación basada en tickets de alta prioridad resueltos (máximo 10 para puntuación completa)
    return Math.min(1.0, highPriorityResolved / 10)
  }

  /**
   * Calcula puntuación basada en disponibilidad (últimas horas de actividad)
   */
  private static async calculateAvailabilityScore(technicianId: string): Promise<number> {
    const user = await prisma.users.findUnique({
      where: { id: technicianId },
      select: { lastLogin: true },
    })

    if (!user?.lastLogin) return 0.5 // Puntuación neutral si no hay datos

    const now = new Date()
    const lastLogin = new Date(user.lastLogin)
    const hoursSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60)

    // Puntuación alta si se conectó en las últimas 8 horas
    if (hoursSinceLogin <= 8) return 1.0
    if (hoursSinceLogin <= 24) return 0.7
    if (hoursSinceLogin <= 72) return 0.4
    return 0.2
  }

  /**
   * Obtiene estadísticas de asignación automática
   */
  static async getAssignmentStats() {
    const [totalAutoAssignments, successfulAssignments, avgAssignmentTime, technicianWorkloads] =
      await Promise.all([
        prisma.ticket_history.count({
          where: { action: 'auto_assigned' },
        }),
        prisma.tickets.count({
          where: {
            assigneeId: { not: null },
            status: { in: ['RESOLVED', 'CLOSED'] },
          },
        }),
        this.calculateAverageAssignmentTime(),
        this.getTechnicianWorkloads(),
      ])

    return {
      totalAutoAssignments,
      successfulAssignments,
      avgAssignmentTime,
      technicianWorkloads,
      successRate:
        totalAutoAssignments > 0 ? (successfulAssignments / totalAutoAssignments) * 100 : 0,
    }
  }

  /**
   * Calcula tiempo promedio de asignación
   */
  private static async calculateAverageAssignmentTime(): Promise<string> {
    const assignments = await prisma.ticket_history.findMany({
      where: { action: 'auto_assigned' },
      select: {
        createdAt: true,
        tickets: {
          select: { createdAt: true },
        },
      },
      take: 100, // Últimas 100 asignaciones
    })

    if (assignments.length === 0) return '0min'

    const totalMinutes = assignments.reduce((acc, assignment) => {
      const diff =
        new Date(assignment.createdAt).getTime() - new Date(assignment.tickets.createdAt).getTime()
      return acc + diff / (1000 * 60)
    }, 0)

    const avgMinutes = totalMinutes / assignments.length
    const hours = Math.floor(avgMinutes / 60)
    const minutes = Math.floor(avgMinutes % 60)

    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
  }

  /**
   * Obtiene cargas de trabajo de técnicos
   */
  private static async getTechnicianWorkloads() {
    const technicians = await prisma.users.findMany({
      where: {
        role: 'TECHNICIAN',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            tickets_tickets_assigneeIdTousers: {
              where: {
                status: { in: ['OPEN', 'IN_PROGRESS'] },
              },
            },
          },
        },
      },
      orderBy: {
        tickets_tickets_assigneeIdTousers: {
          _count: 'desc',
        },
      },
    })

    return technicians.map(tech => ({
      id: tech.id,
      name: tech.name,
      activeTickets: tech._count.tickets_tickets_assigneeIdTousers,
      workloadLevel: this.getWorkloadLevel(tech._count.tickets_tickets_assigneeIdTousers),
    }))
  }

  /**
   * Determina el nivel de carga de trabajo
   */
  private static getWorkloadLevel(activeTickets: number): string {
    if (activeTickets <= 3) return 'Baja'
    if (activeTickets <= 6) return 'Media'
    if (activeTickets <= 10) return 'Alta'
    return 'Sobrecargado'
  }

  /**
   * Reasigna un ticket a otro técnico
   */
  static async reassignTicket(ticketId: string, newTechnicianId: string, userId: string) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_assigneeIdTousers: { select: { name: true } },
      },
    })

    if (!ticket) {
      throw new Error('Ticket no encontrado')
    }

    const newTechnician = await prisma.users.findUnique({
      where: { id: newTechnicianId },
      select: { name: true, role: true },
    })

    if (!newTechnician || !['TECHNICIAN', 'ADMIN'].includes(newTechnician.role)) {
      throw new Error('El usuario seleccionado no puede resolver tickets')
    }

    const updatedTicket = await prisma.tickets.update({
      where: { id: ticketId },
      data: { assigneeId: newTechnicianId },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        users_tickets_assigneeIdTousers: {
          select: { id: true, name: true, email: true },
        },
        users_tickets_clientIdTousers: {
          select: { id: true, name: true, email: true },
        },
        categories: {
          select: { id: true, name: true, color: true },
        },
      },
    })

    // Crear entrada en el historial
    await prisma.ticket_history.create({
      data: {
        id: randomUUID(),
        action: 'reassigned',
        comment: `Ticket reasignado a ${newTechnician.name}`,
        ticketId,
        userId,
        createdAt: new Date(),
      },
    })

    return updatedTicket
  }
}
