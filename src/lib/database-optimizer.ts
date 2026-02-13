/**
 * Database Query Optimizer
 * Analyzes and optimizes database queries for better performance
 */

import prisma from './prisma'
import { performance } from 'perf_hooks'

export interface QueryAnalysis {
  query: string
  executionTime: number
  rowsAffected: number
  indexesUsed: string[]
  recommendations: string[]
  optimizationLevel: 'excellent' | 'good' | 'needs_improvement' | 'poor'
}

export interface IndexRecommendation {
  table: string
  columns: string[]
  type: 'btree' | 'hash' | 'gin' | 'gist'
  reason: string
  estimatedImprovement: string
}

export interface QueryOptimizationResult {
  originalQuery: string
  optimizedQuery: string
  performanceGain: number
  explanation: string
}

class DatabaseOptimizer {
  private queryCache = new Map<string, QueryAnalysis>()
  private slowQueryThreshold = 100 // 100ms

  /**
   * Analyze query performance
   */
  async analyzeQuery(
    queryFn: () => Promise<any>,
    queryDescription: string
  ): Promise<QueryAnalysis> {
    const startTime = performance.now()
    
    try {
      const result = await queryFn()
      const endTime = performance.now()
      const executionTime = endTime - startTime

      const analysis: QueryAnalysis = {
        query: queryDescription,
        executionTime,
        rowsAffected: Array.isArray(result) ? result.length : 1,
        indexesUsed: [], // Would be populated with actual EXPLAIN data
        recommendations: this.generateRecommendations(executionTime, result),
        optimizationLevel: this.getOptimizationLevel(executionTime)
      }

      this.queryCache.set(queryDescription, analysis)
      return analysis
    } catch (error) {
      throw new Error(`Query analysis failed: ${error}`)
    }
  }

  /**
   * Get optimization recommendations for common query patterns
   */
  getIndexRecommendations(): IndexRecommendation[] {
    return [
      {
        table: 'Ticket',
        columns: ['status', 'priority'],
        type: 'btree',
        reason: 'Frequently filtered by status and priority in dashboard queries',
        estimatedImprovement: '60-80% faster filtering'
      },
      {
        table: 'Ticket',
        columns: ['userId'],
        type: 'btree',
        reason: 'User-specific ticket queries are common',
        estimatedImprovement: '70-90% faster user ticket lookups'
      },
      {
        table: 'Ticket',
        columns: ['categoryId'],
        type: 'btree',
        reason: 'Category-based filtering and reporting',
        estimatedImprovement: '50-70% faster category queries'
      },
      {
        table: 'Ticket',
        columns: ['createdAt'],
        type: 'btree',
        reason: 'Time-based queries for reports and recent activity',
        estimatedImprovement: '80-95% faster date range queries'
      },
      {
        table: 'Ticket',
        columns: ['assignedToId'],
        type: 'btree',
        reason: 'Technician workload and assignment queries',
        estimatedImprovement: '70-85% faster assignment lookups'
      },
      {
        table: 'Comment',
        columns: ['ticketId'],
        type: 'btree',
        reason: 'Comments are always queried by ticket',
        estimatedImprovement: '90-95% faster comment loading'
      },
      {
        table: 'Attachment',
        columns: ['ticketId'],
        type: 'btree',
        reason: 'Attachments are always queried by ticket',
        estimatedImprovement: '90-95% faster attachment loading'
      },
      {
        table: 'User',
        columns: ['email'],
        type: 'btree',
        reason: 'Authentication and user lookup by email',
        estimatedImprovement: '95-99% faster login queries'
      },
      {
        table: 'User',
        columns: ['role'],
        type: 'btree',
        reason: 'Role-based access control queries',
        estimatedImprovement: '60-80% faster role filtering'
      },
      {
        table: 'Ticket',
        columns: ['title', 'description'],
        type: 'gin',
        reason: 'Full-text search capabilities',
        estimatedImprovement: '10-100x faster text search'
      }
    ]
  }

  /**
   * Generate optimized queries for common patterns
   */
  getOptimizedQueries(): QueryOptimizationResult[] {
    return [
      {
        originalQuery: `
          // Original: Load tickets with all relations
          prisma.tickets.findMany({
            include: {
              user: true,
              category: true,
              assignedTo: true,
              comments: { include: { user: true } },
              attachments: true
            }
          })
        `,
        optimizedQuery: `
          // Optimized: Select only needed fields
          prisma.tickets.findMany({
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              createdAt: true,
              user: { select: { id: true, name: true, email: true } },
              category: { select: { id: true, name: true, color: true } },
              assignedTo: { select: { id: true, name: true } },
              _count: { select: { comments: true, attachments: true } }
            }
          })
        `,
        performanceGain: 70,
        explanation: 'Reduces data transfer by selecting only required fields and using _count for related records'
      },
      {
        originalQuery: `
          // Original: Separate queries for counts
          const totalTickets = await prisma.tickets.count()
          const openTickets = await prisma.tickets.count({ where: { status: 'OPEN' } })
          const closedTickets = await prisma.tickets.count({ where: { status: 'CLOSED' } })
        `,
        optimizedQuery: `
          // Optimized: Single aggregation query
          const stats = await prisma.tickets.groupBy({
            by: ['status'],
            _count: { id: true }
          })
        `,
        performanceGain: 85,
        explanation: 'Combines multiple count queries into a single aggregation, reducing database round trips'
      },
      {
        originalQuery: `
          // Original: N+1 query problem
          const tickets = await prisma.tickets.findMany()
          for (const ticket of tickets) {
            ticket.comments = await prisma.comments.findMany({
              where: { ticketId: ticket.id }
            })
          }
        `,
        optimizedQuery: `
          // Optimized: Single query with include
          const tickets = await prisma.tickets.findMany({
            include: {
              comments: {
                select: { id: true, content: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                take: 5 // Limit to recent comments
              }
            }
          })
        `,
        performanceGain: 95,
        explanation: 'Eliminates N+1 queries by using include with selective fields and limits'
      },
      {
        originalQuery: `
          // Original: Inefficient pagination
          const tickets = await prisma.tickets.findMany({
            skip: page * limit,
            take: limit,
            orderBy: { createdAt: 'desc' }
          })
        `,
        optimizedQuery: `
          // Optimized: Cursor-based pagination for large datasets
          const tickets = await prisma.tickets.findMany({
            take: limit,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            orderBy: { createdAt: 'desc' }
          })
        `,
        performanceGain: 90,
        explanation: 'Uses cursor-based pagination for better performance on large datasets'
      },
      {
        originalQuery: `
          // Original: Inefficient search
          const tickets = await prisma.tickets.findMany({
            where: {
              OR: [
                { title: { contains: search } },
                { description: { contains: search } }
              ]
            }
          })
        `,
        optimizedQuery: `
          // Optimized: Full-text search with ranking
          const tickets = await prisma.$queryRaw\`
            SELECT *, 
              ts_rank(to_tsvector('english', title || ' ' || description), 
                      plainto_tsquery('english', \${search})) as rank
            FROM "Ticket" 
            WHERE to_tsvector('english', title || ' ' || description) 
                  @@ plainto_tsquery('english', \${search})
            ORDER BY rank DESC
          \`
        `,
        performanceGain: 80,
        explanation: 'Uses PostgreSQL full-text search with ranking for better performance and relevance'
      }
    ]
  }

  /**
   * Analyze slow queries and provide recommendations
   */
  async analyzeSlowQueries(): Promise<{
    slowQueries: QueryAnalysis[]
    recommendations: string[]
    totalQueriesAnalyzed: number
  }> {
    const slowQueries = Array.from(this.queryCache.values())
      .filter(query => query.executionTime > this.slowQueryThreshold)
      .sort((a, b) => b.executionTime - a.executionTime)

    const recommendations = [
      ...this.getGeneralRecommendations(),
      ...slowQueries.flatMap(query => query.recommendations)
    ]

    return {
      slowQueries,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      totalQueriesAnalyzed: this.queryCache.size
    }
  }

  /**
   * Generate database migration for recommended indexes
   */
  generateIndexMigration(): string {
    const recommendations = this.getIndexRecommendations()
    
    let migration = `-- Database Optimization Migration
-- Generated on ${new Date().toISOString()}
-- Adds performance indexes for common query patterns

BEGIN;

`

    recommendations.forEach((rec, index) => {
      const indexName = `idx_${rec.table.toLowerCase()}_${rec.columns.join('_').toLowerCase()}`
      
      if (rec.type === 'gin') {
        migration += `-- Full-text search index for ${rec.table}
CREATE INDEX CONCURRENTLY ${indexName} ON "${rec.table}" USING gin(to_tsvector('english', ${rec.columns.join(" || ' ' || ")}));

`
      } else {
        migration += `-- ${rec.reason}
CREATE INDEX CONCURRENTLY ${indexName} ON "${rec.table}" (${rec.columns.map(col => `"${col}"`).join(', ')});

`
      }
    })

    migration += `COMMIT;

-- Index usage analysis queries:
-- SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes ORDER BY idx_tup_read DESC;
`

    return migration
  }

  /**
   * Create optimized service methods
   */
  createOptimizedQueries() {
    return {
      // Optimized dashboard stats query
      getDashboardStats: async () => {
        return prisma.$transaction(async (tx) => {
          const [statusStats, priorityStats, recentTickets] = await Promise.all([
            tx.tickets.groupBy({
              by: ['status'],
              _count: { id: true }
            }),
            tx.tickets.groupBy({
              by: ['priority'],
              _count: { id: true },
              where: { status: { not: 'CLOSED' } }
            }),
            tx.tickets.findMany({
              take: 5,
              orderBy: { createdAt: 'desc' }
            })
          ])

          return {
            statusStats: statusStats.reduce((acc, stat) => {
              acc[stat.status] = stat._count.id
              return acc
            }, {} as Record<string, number>),
            priorityStats: priorityStats.reduce((acc, stat) => {
              acc[stat.priority] = stat._count.id
              return acc
            }, {} as Record<string, number>),
            recentTickets
          }
        })
      },

      // Optimized ticket search with pagination
      searchTickets: async (params: {
        search?: string
        status?: string
        priority?: string
        categoryId?: string
        clientId?: string
        cursor?: string
        limit?: number
      }) => {
        const { search, status, priority, categoryId, clientId, cursor, limit = 10 } = params

        const where: any = {}
        
        if (search) {
          where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        }
        
        if (status) where.status = status
        if (priority) where.priority = priority
        if (categoryId) where.categoryId = categoryId
        if (clientId) where.clientId = clientId

        return prisma.tickets.findMany({
          where,
          take: limit,
          ...(cursor && { cursor: { id: cursor }, skip: 1 }),
          orderBy: { createdAt: 'desc' },
          include: {
            users_tickets_clientIdTousers: {
              select: { id: true, name: true, email: true }
            },
            categories: {
              select: { id: true, name: true, color: true }
            },
            users_tickets_assigneeIdTousers: {
              select: { id: true, name: true }
            },
            _count: {
              select: { comments: true, attachments: true }
            }
          }
        })
      },

      // Optimized user workload query
      getUserWorkload: async (userId: string) => {
        return prisma.$transaction(async (tx) => {
          const [assigned, created, resolved] = await Promise.all([
            tx.tickets.count({
              where: { assigneeId: userId, status: { not: 'CLOSED' } }
            }),
            tx.tickets.count({
              where: { clientId: userId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
            }),
            tx.tickets.count({
              where: { 
                assigneeId: userId, 
                status: 'CLOSED',
                updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
              }
            })
          ])

          return { assigned, created, resolved }
        })
      },

      // Optimized category statistics
      getCategoryStats: async () => {
        return prisma.categories.findMany({
          select: {
            id: true,
            name: true,
            color: true,
            _count: {
              select: {
                tickets: {
                  where: { status: { not: 'CLOSED' } }
                }
              }
            }
          },
          orderBy: { name: 'asc' }
        })
      },

      // Optimized ticket details with related data
      getTicketDetails: async (ticketId: string) => {
        return prisma.tickets.findUnique({
          where: { id: ticketId },
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
              select: {
                id: true,
                content: true,
                createdAt: true,
                users: { select: { id: true, name: true } }
              },
              orderBy: { createdAt: 'asc' }
            },
            attachments: {
              select: {
                id: true,
                filename: true,
                originalName: true,
                mimeType: true,
                size: true,
                createdAt: true
              }
            }
          }
        })
      }
    }
  }

  private generateRecommendations(executionTime: number, result: any): string[] {
    const recommendations: string[] = []

    if (executionTime > 1000) {
      recommendations.push('Query is very slow (>1s). Consider adding indexes or optimizing the query structure.')
    } else if (executionTime > 500) {
      recommendations.push('Query is slow (>500ms). Review for potential optimizations.')
    } else if (executionTime > 100) {
      recommendations.push('Query could be faster. Consider caching or minor optimizations.')
    }

    if (Array.isArray(result) && result.length > 1000) {
      recommendations.push('Large result set. Consider implementing pagination or limiting results.')
    }

    return recommendations
  }

  private getOptimizationLevel(executionTime: number): QueryAnalysis['optimizationLevel'] {
    if (executionTime < 50) return 'excellent'
    if (executionTime < 100) return 'good'
    if (executionTime < 500) return 'needs_improvement'
    return 'poor'
  }

  private getGeneralRecommendations(): string[] {
    return [
      'Add database indexes for frequently queried columns',
      'Use select instead of include when you only need specific fields',
      'Implement cursor-based pagination for large datasets',
      'Use database transactions for related operations',
      'Consider using raw queries for complex aggregations',
      'Cache frequently accessed data with appropriate TTL',
      'Use connection pooling to manage database connections',
      'Monitor query performance regularly',
      'Implement query result caching for expensive operations',
      'Use database-level constraints and validations'
    ]
  }

  /**
   * Clear query analysis cache
   */
  clearCache(): void {
    this.queryCache.clear()
  }

  /**
   * Get query cache statistics
   */
  getCacheStats() {
    const queries = Array.from(this.queryCache.values())
    const totalQueries = queries.length
    const avgExecutionTime = queries.reduce((sum, q) => sum + q.executionTime, 0) / totalQueries
    const slowQueries = queries.filter(q => q.executionTime > this.slowQueryThreshold).length

    return {
      totalQueries,
      avgExecutionTime: Math.round(avgExecutionTime * 100) / 100,
      slowQueries,
      slowQueryPercentage: Math.round((slowQueries / totalQueries) * 100),
      optimizationLevels: {
        excellent: queries.filter(q => q.optimizationLevel === 'excellent').length,
        good: queries.filter(q => q.optimizationLevel === 'good').length,
        needs_improvement: queries.filter(q => q.optimizationLevel === 'needs_improvement').length,
        poor: queries.filter(q => q.optimizationLevel === 'poor').length
      }
    }
  }
}

export const databaseOptimizer = new DatabaseOptimizer()
export default databaseOptimizer