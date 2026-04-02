import prisma from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { 
  AuditServiceComplete, 
  AuditActionsComplete, 
  logUserActionComplete 
} from './audit-service-complete'

// Función helper para obtener el nombre del nivel
function getLevelName(level: number): string {
  switch (level) {
    case 1: return 'Principal'
    case 2: return 'Subcategoría'
    case 3: return 'Especialidad'
    case 4: return 'Detalle'
    default: return `Nivel ${level}`
  }
}

export interface UserFilters {
  role?: UserRole
  isActive?: boolean
  search?: string
  department?: string
}

export interface PaginationOptions {
  page: number
  limit: number
  offset: number
}

export interface CreateUserData {
  email: string
  name: string
  password: string
  role: UserRole
  departmentId?: string
  department?: string // Deprecated, usar departmentId
  phone?: string
  assignedCategories?: {
    categoryId: string
    priority: number
    maxTickets?: number
    autoAssign?: boolean
  }[]
}

export interface UpdateUserData {
  name?: string
  email?: string
  role?: UserRole
  departmentId?: string | null
  department?: string // Deprecated, usar departmentId
  phone?: string | null
  avatar?: string | null
  isActive?: boolean
  assignedCategories?: {
    categoryId: string
    priority: number
    maxTickets?: number
    autoAssign?: boolean
  }[]
}

export class UserService {
  static async getUsers(filters: UserFilters = {}, pagination?: PaginationOptions) {
    const where: any = {}

    if (filters.role) where.role = filters.role
    if (filters.isActive !== undefined) where.isActive = filters.isActive
    if (filters.department) where.department = filters.department
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    // Incluir asignaciones de técnicos si se está filtrando por rol TECHNICIAN
    const includeTechnicianAssignments = filters.role === 'TECHNICIAN'

    const baseQuery = {
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        departments: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true
          }
        },
        phone: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        _count: {
          select: {
            tickets_tickets_createdByIdTousers: true,
            tickets_tickets_assigneeIdTousers: true,
            technician_assignments: true,
          },
        },
        ...(includeTechnicianAssignments && {
          technician_assignments: {
            where: { isActive: true },
            select: {
              id: true,
              priority: true,
              maxTickets: true,
              autoAssign: true,
              categories: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  level: true,
                }
              }
            },
            orderBy: { priority: 'asc' as const }
          }
        })
      },
      orderBy: { createdAt: 'desc' } as const,
    }

    if (pagination) {
      // Con paginación
      const [users, total] = await Promise.all([
        prisma.users.findMany({
          ...baseQuery,
          skip: pagination.offset,
          take: pagination.limit,
        }),
        prisma.users.count({ where }),
      ])

      // Enriquecer datos para técnicos
      const enrichedUsers = users.map(user => {
        if (user.role === 'TECHNICIAN' && user.technician_assignments) {
          return {
            ...user,
            technician_assignments: user.technician_assignments.map((assignment: any) => ({
              ...assignment,
              category: {
                ...assignment.category,
                levelName: getLevelName(assignment.categories.level)
              }
            }))
          }
        }
        return user
      })

      return { users: enrichedUsers, total }
    } else {
      // Sin paginación (compatibilidad hacia atrás)
      const users = await prisma.users.findMany(baseQuery)
      
      // Enriquecer datos para técnicos
      const enrichedUsers = users.map(user => {
        if (user.role === 'TECHNICIAN' && user.technician_assignments) {
          return {
            ...user,
            technician_assignments: user.technician_assignments.map((assignment: any) => ({
              ...assignment,
              category: {
                ...assignment.category,
                levelName: getLevelName(assignment.categories.level)
              }
            }))
          }
        }
        return user
      })
      
      return enrichedUsers
    }
  }

  static async getUserById(id: string) {
    return prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        departments: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true
          }
        },
        phone: true,
        avatar: true,
        isActive: true,
        isEmailVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tickets_tickets_createdByIdTousers: true,
            tickets_tickets_assigneeIdTousers: true,
          },
        },
      },
    })
  }

  static async createUser(data: CreateUserData, performedBy?: string) {
    const existingUser = await prisma.users.findUnique({
      where: { email: data.email },
    })

    if (existingUser) {
      throw new Error('Ya existe un usuario con este email')
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    // Crear el usuario en una transacción para manejar las asignaciones de categorías
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          id: randomUUID(),
          email: data.email,
          name: data.name,
          passwordHash,
          role: data.role,
          departmentId: data.departmentId || data.department || null,
          phone: data.phone || null,
          isActive: true,
          isEmailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          departments: {
            select: {
              id: true,
              name: true,
              color: true,
              description: true
            }
          }
        }
      })

      // Si es técnico y tiene categorías asignadas, crear las asignaciones
      if (data.role === 'TECHNICIAN' && data.assignedCategories && data.assignedCategories.length > 0) {
        await tx.technician_assignments.createMany({
          data: data.assignedCategories.map(assignment => ({
            id: randomUUID(),
            technicianId: user.id,
            categoryId: assignment.categoryId,
            priority: assignment.priority,
            maxTickets: assignment.maxTickets || 10,
            autoAssign: assignment.autoAssign ?? true,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        })
      }

      // Crear user_settings por defecto (garantiza que las notificaciones estén habilitadas)
      await tx.user_settings.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          emailNotifications: true,
          pushNotifications: true,
          ticketCreated: true,
          ticketAssigned: true,
          statusChanged: true,
          newComments: true,
          ticketUpdated: true,
          updatedAt: new Date(),
        }
      })

      // Registrar auditoría
      if (performedBy) {
        await AuditServiceComplete.log({
          action: AuditActionsComplete.USER_CREATED,
          entityType: 'user',
          entityId: user.id,
          userId: performedBy,
          details: {
            userEmail: user.email,
            userName: user.name,
            userRole: user.role,
            departmentId: user.departmentId,
            assignedCategories: data.assignedCategories?.length || 0
          },
          newValues: {
            email: user.email,
            name: user.name,
            role: user.role,
            departmentId: user.departmentId,
            isActive: user.isActive
          }
        })
      }

      return user
    })

    return {
      id: result.id,
      email: result.email,
      name: result.name,
      role: result.role,
      departmentId: result.departmentId,
      department: result.departments,
      phone: result.phone,
      isActive: result.isActive,
      createdAt: result.createdAt,
    }
  }

  static async updateUser(id: string, data: UpdateUserData) {
    const user = await prisma.users.findUnique({ where: { id } })
    if (!user) throw new Error('Usuario no encontrado')

    if (data.email && data.email !== user.email) {
      const existingUser = await prisma.users.findUnique({
        where: { email: data.email },
      })
      if (existingUser) {
        throw new Error('Ya existe un usuario con este email')
      }
    }

    // Preparar datos de actualización
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.email !== undefined) updateData.email = data.email
    if (data.role !== undefined) updateData.role = data.role
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.avatar !== undefined) updateData.avatar = data.avatar
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    
    // Manejar departmentId explícitamente
    if (data.departmentId !== undefined) {
      updateData.departmentId = data.departmentId || null
    } else if (data.department !== undefined) {
      // Soporte legacy para 'department'
      updateData.departmentId = data.department || null
    }

    console.log('🔧 [UserService] Datos que se enviarán a Prisma:', updateData)

    // Actualizar usuario en una transacción para manejar las asignaciones de categorías
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.users.update({
        where: { id },
        data: updateData,
        include: {
          departments: {
            select: {
              id: true,
              name: true,
              color: true,
              description: true
            }
          }
        }
      })

      // Si es técnico y se proporcionaron asignaciones de categorías, actualizarlas
      if (data.role === 'TECHNICIAN' && data.assignedCategories !== undefined) {
        // Eliminar asignaciones existentes
        await tx.technician_assignments.deleteMany({
          where: { technicianId: id },
        })

        // Crear nuevas asignaciones si las hay
        if (data.assignedCategories.length > 0) {
          await tx.technician_assignments.createMany({
            data: data.assignedCategories.map(assignment => ({
              id: randomUUID(),
              technicianId: id,
              categoryId: assignment.categoryId,
              priority: assignment.priority,
              maxTickets: assignment.maxTickets || 10,
              autoAssign: assignment.autoAssign ?? true,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          })
        }
      }

      return updatedUser
    })

    console.log('✅ [UserService] Usuario actualizado en BD:', {
      id: result.id,
      departmentId: result.departmentId,
      department: result.departments?.name
    })

    return {
      id: result.id,
      email: result.email,
      name: result.name,
      role: result.role,
      departmentId: result.departmentId,
      department: result.departments,
      phone: result.phone,
      isActive: result.isActive,
      updatedAt: result.updatedAt,
    }
  }

  static async deleteUser(id: string) {
    // Verificar si el usuario tiene tickets asignados activos
    const activeTickets = await prisma.tickets.count({
      where: { assigneeId: id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    })

    if (activeTickets > 0) {
      throw new Error('No se puede eliminar un usuario con tickets activos asignados. Reasigna o cierra los tickets primero.')
    }

    await prisma.$transaction(async (tx) => {
      // --- Campos no-nullable: hay que ELIMINAR los registros ---

      // Asignaciones de técnico
      await tx.technician_assignments.deleteMany({ where: { technicianId: id } })

      // Historial de tickets (userId NOT NULL)
      await tx.ticket_history.deleteMany({ where: { userId: id } })

      // Comentarios (authorId NOT NULL)
      await tx.comments.deleteMany({ where: { authorId: id } })

      // Attachments (uploadedBy NOT NULL)
      await tx.attachments.deleteMany({ where: { uploadedBy: id } })

      // Calificaciones de tickets (clientId NOT NULL, technicianId nullable)
      await tx.ticket_ratings.deleteMany({ where: { OR: [{ clientId: id }, { technicianId: id }] } })

      // Artículos de conocimiento (authorId NOT NULL) — eliminar votos primero
      const articles = await tx.knowledge_articles.findMany({
        where: { authorId: id },
        select: { id: true },
      })
      if (articles.length > 0) {
        const articleIds = articles.map(a => a.id)
        await tx.article_votes.deleteMany({ where: { articleId: { in: articleIds } } })
        await tx.ticket_knowledge_articles.deleteMany({ where: { articleId: { in: articleIds } } })
        await tx.knowledge_articles.deleteMany({ where: { authorId: id } })
      }

      // Planes de resolución (createdBy NOT NULL) — las tareas se eliminan en cascade
      await tx.resolution_plans.deleteMany({ where: { createdBy: id } })

      // Registros de mantenimiento (technicianId NOT NULL)
      await tx.maintenance_records.deleteMany({ where: { technicianId: id } })

      // Movimientos de stock (userId NOT NULL)
      await tx.stock_movements.deleteMany({ where: { userId: id } })

      // --- Campos nullable: NULLIFICAR en lugar de eliminar ---

      // Tickets: desasignar assignee, nullificar createdById
      await tx.tickets.updateMany({ where: { assigneeId: id }, data: { assigneeId: null, status: 'OPEN' } })
      await tx.tickets.updateMany({ where: { createdById: id }, data: { createdById: null } })

      // Tareas de resolución: nullificar assignedTo (nullable)
      await tx.resolution_tasks.updateMany({ where: { assignedTo: id }, data: { assignedTo: null } })

      // Webhooks: nullificar createdBy (nullable)
      await tx.webhooks.updateMany({ where: { createdBy: id }, data: { createdBy: null } })

      // Movimientos de stock: nullificar assignedToUserId (nullable)
      await tx.stock_movements.updateMany({ where: { assignedToUserId: id }, data: { assignedToUserId: null } })

      // Licencias de software: nullificar assignedToUser (nullable)
      await tx.software_licenses.updateMany({ where: { assignedToUser: id }, data: { assignedToUser: null } })

      // Eliminar el usuario (Prisma cascade elimina: accounts, sessions,
      // notification_preferences, notifications, user_settings,
      // password_reset_tokens, article_votes)
      await tx.users.delete({ where: { id } })
    })
  }

  static async getUserStats() {
    const [totalUsers, activeUsers, adminUsers, technicianUsers, clientUsers, recentUsers] =
      await Promise.all([
        prisma.users.count(),
        prisma.users.count({ where: { isActive: true } }),
        prisma.users.count({ where: { role: 'ADMIN' } }),
        prisma.users.count({ where: { role: 'TECHNICIAN' } }),
        prisma.users.count({ where: { role: 'CLIENT' } }),
        prisma.users.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30)),
            },
          },
        }),
      ])

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      adminUsers,
      technicianUsers,
      clientUsers,
      recentUsers,
    }
  }

  static async getTechnicians() {
    return prisma.users.findMany({
      where: {
        role: 'TECHNICIAN',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        departmentId: true,
        departments: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true
          }
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
      orderBy: { name: 'asc' },
    })
  }

  static async getTechnicianWorkload(technicianId: string) {
    const [openTickets, inProgressTickets, resolvedThisWeek, avgResolutionTime, activeAssignments] = await Promise.all(
      [
        prisma.tickets.count({
          where: { assigneeId: technicianId, status: 'OPEN' },
        }),
        prisma.tickets.count({
          where: { assigneeId: technicianId, status: 'IN_PROGRESS' },
        }),
        prisma.tickets.count({
          where: {
            assigneeId: technicianId,
            status: 'RESOLVED',
            resolvedAt: {
              gte: new Date(new Date().setDate(new Date().getDate() - 7)),
            },
          },
        }),
        this.calculateAvgResolutionTime(technicianId),
        prisma.technician_assignments.count({
          where: { 
            technicianId: technicianId,
            isActive: true,
          },
        }),
      ]
    )

    return {
      openTickets,
      inProgressTickets,
      totalActiveTickets: openTickets + inProgressTickets,
      resolvedThisWeek,
      avgResolutionTime,
      activeAssignments,
      canDelete: openTickets === 0 && inProgressTickets === 0 && activeAssignments === 0,
    }
  }

  private static async calculateAvgResolutionTime(technicianId: string): Promise<string> {
    const resolvedTickets = await prisma.tickets.findMany({
      where: {
        assigneeId: technicianId,
        status: 'RESOLVED',
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
      take: 50, // últimos 50 tickets resueltos
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
}
