import prisma from '@/lib/prisma'

export interface TechnicianAssignmentStrategy {
  categoryId: string
  categoryLevel: number
  categoryPath: string[]
  availableTechnicians: {
    id: string
    name: string
    email: string
    priority: number
    maxTickets: number
    autoAssign: boolean
    currentTickets: number
    categoryLevel: number
    categoryName: string
  }[]
}

export class TechnicianAssignmentService {
  /**
   * Obtiene la estrategia de asignación en cascada para una categoría
   * Busca técnicos en el nivel actual, si no hay disponibles, sube al nivel padre
   */
  static async getAssignmentStrategy(categoryId: string): Promise<TechnicianAssignmentStrategy> {
    // Obtener la categoría y construir la ruta jerárquica
    const category = await prisma.categories.findUnique({
      where: { id: categoryId },
      include: {
        categories: true  // Relación con el padre
      }
    })

    if (!category) {
      throw new Error('Categoría no encontrada')
    }

    // Construir la ruta desde la categoría actual hasta la raíz
    const categoryPath: string[] = []
    let currentCategory: any = category
    
    while (currentCategory) {
      categoryPath.unshift(currentCategory.id)
      // Cargar el padre si existe
      if (currentCategory.parentId) {
        currentCategory = await prisma.categories.findUnique({
          where: { id: currentCategory.parentId }
        })
      } else {
        currentCategory = null
      }
    }

    // Buscar técnicos disponibles en cascada (desde el nivel más específico al más general)
    const availableTechnicians = await this.findAvailableTechniciansInCascade(categoryPath)

    return {
      categoryId,
      categoryLevel: category.level,
      categoryPath,
      availableTechnicians
    }
  }

  /**
   * Busca técnicos disponibles siguiendo la cascada jerárquica
   */
  private static async findAvailableTechniciansInCascade(categoryPath: string[]) {
    const allTechnicians: any[] = []

    // Recorrer desde el nivel más específico (final del array) al más general (inicio)
    for (let i = categoryPath.length - 1; i >= 0; i--) {
      const categoryId = categoryPath[i]
      
      const technicians = await prisma.technician_assignments.findMany({
        where: {
          categoryId,
          isActive: true,
          users: {
            isActive: true,
            role: 'TECHNICIAN'
          }
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              departments: true,
              _count: {
                select: {
                  tickets_tickets_assigneeIdTousers: {
                    where: {
                      status: {
                        in: ['OPEN', 'IN_PROGRESS']
                      }
                    }
                  }
                }
              }
            }
          },
          categories: {
            select: {
              id: true,
              name: true,
              level: true
            }
          }
        },
        orderBy: {
          priority: 'asc'
        }
      })

      // Agregar técnicos que no estén ya en la lista y que tengan capacidad
      for (const assignment of technicians) {
        const existingTech = allTechnicians.find(t => t.id === assignment.users.id)
        if (!existingTech) {
          const currentTickets = assignment.users._count.tickets_tickets_assigneeIdTousers
          const maxTickets = assignment.maxTickets || 10
          const hasCapacity = currentTickets < maxTickets
          
          if (hasCapacity && assignment.autoAssign) {
            allTechnicians.push({
              id: assignment.users.id,
              name: assignment.users.name,
              email: assignment.users.email,
              priority: assignment.priority,
              maxTickets: maxTickets,
              autoAssign: assignment.autoAssign,
              currentTickets,
              categoryLevel: assignment.categories.level,
              categoryName: assignment.categories.name,
              department: assignment.users.departments
            })
          }
        }
      }

      // Si encontramos técnicos disponibles en este nivel, no necesitamos subir más
      if (allTechnicians.length > 0) {
        break
      }
    }

    return allTechnicians.sort((a, b) => {
      // Ordenar por nivel de categoría (más específico primero) y luego por prioridad
      if (a.categoryLevel !== b.categoryLevel) {
        return b.categoryLevel - a.categoryLevel // Nivel más alto primero
      }
      return a.priority - b.priority // Prioridad más baja (más importante) primero
    })
  }

  /**
   * Asigna automáticamente un técnico basado en la estrategia de cascada
   */
  static async assignTechnicianToTicket(ticketId: string, categoryId: string): Promise<string | null> {
    const strategy = await this.getAssignmentStrategy(categoryId)
    
    if (strategy.availableTechnicians.length === 0) {
      return null
    }

    // Seleccionar el técnico con mayor prioridad (menor número) y menor carga
    const selectedTechnician = strategy.availableTechnicians[0]

    // Asignar el ticket
    await prisma.tickets.update({
      where: { id: ticketId },
      data: { 
        assigneeId: selectedTechnician.id,
        status: 'IN_PROGRESS'
      }
    })
    
    return selectedTechnician.id
  }

  /**
   * Obtiene estadísticas de asignación por categoría
   */
  static async getAssignmentStats(categoryId: string) {
    const assignments = await prisma.technician_assignments.findMany({
      where: {
        categoryId,
        isActive: true
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                tickets_tickets_assigneeIdTousers: {
                  where: {
                    status: {
                      in: ['OPEN', 'IN_PROGRESS']
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    return assignments.map(assignment => ({
      technicianId: assignment.users.id,
      technicianName: assignment.users.name,
      priority: assignment.priority,
      maxTickets: assignment.maxTickets || 10,
      currentTickets: assignment.users._count.tickets_tickets_assigneeIdTousers,
      utilization: (assignment.users._count.tickets_tickets_assigneeIdTousers / (assignment.maxTickets || 10)) * 100,
      autoAssign: assignment.autoAssign
    }))
  }

  /**
   * Simula la asignación para mostrar qué técnico sería seleccionado
   */
  static async simulateAssignment(categoryId: string): Promise<{
    selectedTechnician: any | null
    strategy: TechnicianAssignmentStrategy
    reason: string
  }> {
    const strategy = await this.getAssignmentStrategy(categoryId)
    
    if (strategy.availableTechnicians.length === 0) {
      return {
        selectedTechnician: null,
        strategy,
        reason: 'No hay técnicos disponibles en ningún nivel de la jerarquía'
      }
    }

    const selectedTechnician = strategy.availableTechnicians[0]
    const reason = `Seleccionado por: Nivel ${selectedTechnician.categoryLevel} (${selectedTechnician.categoryName}), Prioridad ${selectedTechnician.priority}, Carga actual: ${selectedTechnician.currentTickets}/${selectedTechnician.maxTickets}`

    return {
      selectedTechnician,
      strategy,
      reason
    }
  }

  /**
   * Rebalancea las asignaciones cuando se cambian las configuraciones
   */
  static async rebalanceAssignments(categoryId: string) {
    // Obtener tickets pendientes de asignación en esta categoría
    const pendingTickets = await prisma.tickets.findMany({
      where: {
        categoryId,
        assigneeId: null,
        status: 'OPEN'
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    const results = []
    
    for (const ticket of pendingTickets) {
      try {
        const assignedTechnicianId = await this.assignTechnicianToTicket(ticket.id, categoryId)
        results.push({
          ticketId: ticket.id,
          assignedTechnicianId,
          success: !!assignedTechnicianId
        })
      } catch (error) {
        console.error('[CRITICAL] Error asignando ticket:', ticket.id, error)
        results.push({
          ticketId: ticket.id,
          assignedTechnicianId: null,
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }

    return results
  }
}