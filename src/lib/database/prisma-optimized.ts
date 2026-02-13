/**
 * CONFIGURACIÓN OPTIMIZADA DE PRISMA
 *
 * Esta configuración mejora el performance y la confiabilidad
 * de las conexiones a la base de datos
 */

import { PrismaClient } from '@prisma/client'

// Configuración de logging basada en el entorno
const getLogLevel = (): any => {
  if (process.env.NODE_ENV === 'development') {
    return ['query', 'info', 'warn', 'error']
  }
  if (process.env.NODE_ENV === 'test') {
    return ['error']
  }
  return ['warn', 'error']
}

// Configuración de conexión optimizada
const getDatabaseConfig = () => {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) {
    throw new Error('DATABASE_URL no está configurada')
  }

  // Parámetros de conexión optimizados
  const connectionParams = new URLSearchParams({
    connection_limit: '20', // Máximo 20 conexiones
    pool_timeout: '20', // Timeout de 20 segundos
    connect_timeout: '10', // Timeout de conexión 10 segundos
    socket_timeout: '30', // Timeout de socket 30 segundos
    pgbouncer: 'true', // Compatibilidad con PgBouncer
  })

  // Si la URL ya tiene parámetros, los combinamos
  const url = new URL(baseUrl)
  connectionParams.forEach((value, key) => {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

// Singleton global para evitar múltiples instancias
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configuración del cliente Prisma
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: getLogLevel(),
    datasources: {
      db: {
        url: getDatabaseConfig(),
      },
    },
    errorFormat: 'pretty',
  })

// En desarrollo, guardamos la instancia globalmente para hot reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Middleware para logging de queries lentas
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()
  const duration = after - before

  // Log queries que toman más de 100ms
  if (duration > 100) {
    console.warn(`🐌 Query lenta detectada: ${duration}ms`, {
      model: params.model,
      action: params.action,
      duration: `${duration}ms`,
    })
  }

  // Log queries que toman más de 1 segundo como error
  if (duration > 1000) {
    console.error(`🚨 Query muy lenta: ${duration}ms`, {
      model: params.model,
      action: params.action,
      args: params.args,
      duration: `${duration}ms`,
    })
  }

  return result
})

// Middleware para auditoría automática
prisma.$use(async (params, next) => {
  // Solo auditar operaciones de escritura
  if (!['create', 'update', 'delete', 'upsert'].includes(params.action)) {
    return next(params)
  }

  const result = await next(params)

  // TODO: Implementar auditoría automática aquí
  // Se implementará en la tarea de auditoría

  return result
})

// Funciones de utilidad para manejo de conexiones
export class DatabaseUtils {
  /**
   * Verifica la salud de la conexión a la base de datos
   */
  static async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy'
    responseTime: number
    error?: string
  }> {
    const start = Date.now()

    try {
      await prisma.$queryRaw`SELECT 1`
      const responseTime = Date.now() - start

      return {
        status: 'healthy',
        responseTime,
      }
    } catch (error) {
      const responseTime = Date.now() - start

      return {
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }
    }
  }

  /**
   * Obtiene estadísticas de conexión
   */
  static async getConnectionStats(): Promise<{
    activeConnections: number
    maxConnections: number
    databaseSize: string
  }> {
    try {
      const [connectionInfo, dbSize] = await Promise.all([
        prisma.$queryRaw<Array<{ active: string; max: string }>>`
          SELECT 
            (SELECT count(*)::text FROM pg_stat_activity WHERE state = 'active') as active,
            (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max
        `,
        prisma.$queryRaw<Array<{ size: string }>>`
          SELECT pg_size_pretty(pg_database_size(current_database())) as size
        `,
      ])

      return {
        activeConnections: parseInt(connectionInfo[0]?.active || '0'),
        maxConnections: parseInt(connectionInfo[0]?.max || '0'),
        databaseSize: dbSize[0]?.size || 'Desconocido',
      }
    } catch (error) {
      console.error('Error obteniendo estadísticas de conexión:', error)
      return {
        activeConnections: 0,
        maxConnections: 0,
        databaseSize: 'Error',
      }
    }
  }

  /**
   * Obtiene queries lentas activas
   */
  static async getSlowQueries(): Promise<
    Array<{
      query: string
      duration: string
      state: string
    }>
  > {
    try {
      const slowQueries = await prisma.$queryRaw<
        Array<{
          query: string
          duration: string
          state: string
        }>
      >`
        SELECT 
          query,
          now() - query_start as duration,
          state
        FROM pg_stat_activity 
        WHERE state != 'idle' 
          AND query != '<IDLE>'
          AND now() - query_start > interval '1 second'
        ORDER BY duration DESC
        LIMIT 10
      `

      return slowQueries
    } catch (error) {
      console.error('Error obteniendo queries lentas:', error)
      return []
    }
  }

  /**
   * Limpia conexiones inactivas
   */
  static async cleanupConnections(): Promise<number> {
    try {
      const result = await prisma.$queryRaw<Array<{ terminated: string }>>`
        SELECT count(*)::text as terminated
        FROM pg_terminate_backend(pid)
        WHERE pid IN (
          SELECT pid 
          FROM pg_stat_activity 
          WHERE state = 'idle' 
            AND query_start < now() - interval '1 hour'
            AND pid != pg_backend_pid()
        )
      `

      return parseInt(result[0]?.terminated || '0')
    } catch (error) {
      console.error('Error limpiando conexiones:', error)
      return 0
    }
  }
}

// Manejo de cierre graceful
process.on('beforeExit', async () => {
  console.log('🔌 Cerrando conexiones de base de datos...')
  await prisma.$disconnect()
})

process.on('SIGINT', async () => {
  console.log('🔌 Cerrando conexiones de base de datos (SIGINT)...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('🔌 Cerrando conexiones de base de datos (SIGTERM)...')
  await prisma.$disconnect()
  process.exit(0)
})

export default prisma
