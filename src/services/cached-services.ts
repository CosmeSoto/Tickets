/**
 * Cached Services
 * Service layer with integrated caching for performance optimization
 */

import prisma from '@/lib/prisma'
import { cacheService, Cache, InvalidateCache, CachePatterns } from '@/lib/cache'
import type { tickets, categories, users, TicketPriority, TicketStatus } from '@prisma/client'

/**
 * Cached Category Service
 */
export class CachedCategoryService {
  private static readonly CACHE_TTL = 3600 // 1 hour
  private static readonly CACHE_PREFIX = 'categories'

  @Cache({ 
    ttl: CachedCategoryService.CACHE_TTL, 
    prefix: CachedCategoryService.CACHE_PREFIX,
    tags: ['categories']
  })
  async getCategories(filters?: {
    isActive?: boolean
    search?: string
  }) {
    const where: any = {}
    
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive
    }
    
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ]
    }

    return prisma.categories.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { tickets: true }
        }
      }
    })
  }

  @Cache({ 
    ttl: CachedCategoryService.CACHE_TTL, 
    prefix: CachedCategoryService.CACHE_PREFIX,
    tags: ['categories']
  })
  async getCategoryById(id: string) {
    return prisma.categories.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tickets: true }
        }
      }
    })
  }

  @InvalidateCache(['categories'])
  async createCategory(data: {
    name: string
    description?: string
    level: number
    parentId?: string
    order?: number
    color?: string
    isActive?: boolean
  }) {
    const { randomUUID } = await import('crypto')
    return prisma.categories.create({
      data: {
        ...data,
        id: randomUUID(),
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: { tickets: true }
        }
      }
    })
  }

  @InvalidateCache(['categories'])
  async updateCategory(id: string, data: {
    name?: string
    description?: string
    level?: number
    parentId?: string
    order?: number
    color?: string
    isActive?: boolean
  }) {
    return prisma.categories.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { tickets: true }
        }
      }
    })
  }

  @InvalidateCache(['categories'])
  async deleteCategory(id: string) {
    return prisma.categories.delete({
      where: { id }
    })
  }

  /**
   * Get category statistics with caching
   */
  async getCategoryStats() {
    return CachePatterns.cacheWithRefresh(
      'category-stats',
      async () => {
        const stats = await prisma.categories.findMany({
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                tickets: {
                  where: {
                    status: { not: 'CLOSED' }
                  }
                }
              }
            }
          }
        })

        return stats.map(category => ({
          id: category.id,
          name: category.name,
          activeTickets: category._count.tickets
        }))
      },
      { 
        ttl: 300, // 5 minutes
        prefix: CachedCategoryService.CACHE_PREFIX,
        refreshThreshold: 60 // Refresh when 1 minute left
      }
    )
  }
}

/**
 * Cached Ticket Service
 */
export class CachedTicketService {
  private static readonly CACHE_TTL = 1800 // 30 minutes
  private static readonly CACHE_PREFIX = 'tickets'

  async getTickets(filters?: {
    status?: TicketStatus
    priority?: TicketPriority
    categoryId?: string
    clientId?: string
    search?: string
    page?: number
    limit?: number
  }) {
    const cacheKey = `tickets-list:${JSON.stringify(filters || {})}`
    
    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const page = filters?.page || 1
        const limit = filters?.limit || 10
        const skip = (page - 1) * limit

        const where: any = {}
        
        if (filters?.status) {
          where.status = filters.status
        }
        
        if (filters?.priority) {
          where.priority = filters.priority
        }
        
        if (filters?.categoryId) {
          where.categoryId = filters.categoryId
        }
        
        if (filters?.clientId) {
          where.clientId = filters.clientId
        }
        
        if (filters?.search) {
          where.OR = [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } }
          ]
        }

        const [tickets, total] = await Promise.all([
          prisma.tickets.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              users_tickets_clientIdTousers: {
                select: { id: true, name: true, email: true }
              },
              categories: {
                select: { id: true, name: true, color: true }
              },
              users_tickets_assigneeIdTousers: {
                select: { id: true, name: true, email: true }
              },
              _count: {
                select: { comments: true, attachments: true }
              }
            }
          }),
          prisma.tickets.count({ where })
        ])

        return {
          tickets,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      },
      { 
        ttl: CachedTicketService.CACHE_TTL,
        prefix: CachedTicketService.CACHE_PREFIX,
        tags: ['tickets', 'tickets-list']
      }
    )
  }

  @Cache({ 
    ttl: CachedTicketService.CACHE_TTL, 
    prefix: CachedTicketService.CACHE_PREFIX,
    tags: ['tickets']
  })
  async getTicketById(id: string) {
    return prisma.tickets.findUnique({
      where: { id },
      include: {
        users_tickets_clientIdTousers: {
          select: { id: true, name: true, email: true }
        },
        categories: {
          select: { id: true, name: true, color: true }
        },
        users_tickets_assigneeIdTousers: {
          select: { id: true, name: true, email: true }
        },
        comments: {
          include: {
            users: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        attachments: true
      }
    })
  }

  @InvalidateCache(['tickets', 'tickets-list', 'dashboard-stats'])
  async createTicket(data: {
    title: string
    description: string
    priority: TicketPriority
    categoryId: string
    clientId: string
    assigneeId?: string
  }) {
    const { randomUUID } = await import('crypto')
    return prisma.tickets.create({
      data: {
        ...data,
        id: randomUUID(),
        status: 'OPEN',
        updatedAt: new Date(),
      },
      include: {
        users_tickets_clientIdTousers: {
          select: { id: true, name: true, email: true }
        },
        categories: {
          select: { id: true, name: true, color: true }
        },
        users_tickets_assigneeIdTousers: {
          select: { id: true, name: true, email: true }
        }
      }
    })
  }

  @InvalidateCache(['tickets', 'tickets-list', 'dashboard-stats'])
  async updateTicket(id: string, data: {
    title?: string
    description?: string
    status?: TicketStatus
    priority?: TicketPriority
    categoryId?: string
    assigneeId?: string
  }) {
    return prisma.tickets.update({
      where: { id },
      data,
      include: {
        users_tickets_clientIdTousers: {
          select: { id: true, name: true, email: true }
        },
        categories: {
          select: { id: true, name: true, color: true }
        },
        users_tickets_assigneeIdTousers: {
          select: { id: true, name: true, email: true }
        }
      }
    })
  }

  /**
   * Get dashboard statistics with multi-level caching
   */
  async getDashboardStats() {
    return CachePatterns.multiLevelCache(
      'dashboard-stats',
      async () => {
        const [
          totalTickets,
          openTickets,
          inProgressTickets,
          closedTickets,
          highPriorityTickets,
          recentTickets
        ] = await Promise.all([
          prisma.tickets.count(),
          prisma.tickets.count({ where: { status: 'OPEN' } }),
          prisma.tickets.count({ where: { status: 'IN_PROGRESS' } }),
          prisma.tickets.count({ where: { status: 'CLOSED' } }),
          prisma.tickets.count({ where: { priority: 'HIGH' } }),
          prisma.tickets.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              users_tickets_clientIdTousers: { select: { name: true } },
              categories: { select: { name: true, color: true } }
            }
          })
        ])

        return {
          totalTickets,
          openTickets,
          inProgressTickets,
          closedTickets,
          highPriorityTickets,
          recentTickets
        }
      },
      { 
        ttl: 300, // 5 minutes in Redis
        memoryTtl: 60, // 1 minute in memory
        prefix: CachedTicketService.CACHE_PREFIX,
        tags: ['dashboard-stats']
      }
    )
  }
}

/**
 * Cached User Service
 */
export class CachedUserService {
  private static readonly CACHE_TTL = 3600 // 1 hour
  private static readonly CACHE_PREFIX = 'users'

  @Cache({ 
    ttl: CachedUserService.CACHE_TTL, 
    prefix: CachedUserService.CACHE_PREFIX,
    tags: ['users']
  })
  async getUsers(filters?: {
    role?: string
    active?: boolean
    search?: string
  }) {
    const where: any = {}
    
    if (filters?.role) {
      where.role = filters.role
    }
    
    if (filters?.active !== undefined) {
      where.active = filters.active
    }
    
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } }
      ]
    }

    return prisma.users.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            tickets_tickets_createdByIdTousers: true,
            tickets_tickets_assigneeIdTousers: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })
  }

  @Cache({ 
    ttl: CachedUserService.CACHE_TTL, 
    prefix: CachedUserService.CACHE_PREFIX,
    tags: ['users']
  })
  async getUserById(id: string) {
    return prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            tickets_tickets_createdByIdTousers: true,
            tickets_tickets_assigneeIdTousers: true
          }
        }
      }
    })
  }

  /**
   * Get user statistics with caching
   */
  async getUserStats(userId: string) {
    return CachePatterns.cacheWithRefresh(
      `user-stats:${userId}`,
      async () => {
        const [
          totalTickets,
          openTickets,
          tickets_tickets_assigneeIdTousers,
          resolvedTickets
        ] = await Promise.all([
          prisma.tickets.count({ where: { clientId: userId } }),
          prisma.tickets.count({ where: { clientId: userId, status: 'OPEN' } }),
          prisma.tickets.count({ where: { assigneeId: userId } }),
          prisma.tickets.count({ where: { assigneeId: userId, status: 'CLOSED' } })
        ])

        return {
          totalTickets,
          openTickets,
          tickets_tickets_assigneeIdTousers,
          resolvedTickets,
          resolutionRate: tickets_tickets_assigneeIdTousers > 0 ? (resolvedTickets / tickets_tickets_assigneeIdTousers) * 100 : 0
        }
      },
      { 
        ttl: 600, // 10 minutes
        prefix: CachedUserService.CACHE_PREFIX,
        refreshThreshold: 120 // Refresh when 2 minutes left
      }
    )
  }
}

/**
 * Cache Management Service
 */
export class CacheManagementService {
  /**
   * Warm up critical caches
   */
  async warmUpCaches() {
    const categoryService = new CachedCategoryService()
    const ticketService = new CachedTicketService()
    
    try {
      // Warm up most accessed data
      await Promise.all([
        categoryService.getCategories({ isActive: true }),
        categoryService.getCategoryStats(),
        ticketService.getDashboardStats(),
        ticketService.getTickets({ page: 1, limit: 10 })
      ])
    } catch (error) {
      // Error silencioso - el cache se calentará en el próximo request
    }
  }

  /**
   * Clear all application caches
   */
  async clearAllCaches() {
    const patterns = ['categories:*', 'tickets:*', 'users:*']
    let totalCleared = 0
    
    for (const pattern of patterns) {
      const cleared = await cacheService.clear(pattern)
      totalCleared += cleared
    }
    
    return totalCleared
  }

  /**
   * Get cache health metrics
   */
  async getCacheHealth() {
    const stats = cacheService.getStats()
    const hitRatio = cacheService.getHitRatio()
    
    return {
      ...stats,
      hitRatio: Math.round(hitRatio * 100),
      status: hitRatio > 0.7 ? 'healthy' : hitRatio > 0.5 ? 'warning' : 'poor'
    }
  }

  /**
   * Invalidate caches by entity type
   */
  async invalidateEntity(entity: 'tickets' | 'categories' | 'users') {
    return cacheService.invalidateByTags([entity])
  }
}

// Export service instances
export const cachedCategoryService = new CachedCategoryService()
export const cachedTicketService = new CachedTicketService()
export const cachedUserService = new CachedUserService()
export const cacheManagementService = new CacheManagementService()