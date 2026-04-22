/**
 * DatabaseUtils — utilidades de salud y diagnóstico de la base de datos.
 * Usa el singleton centralizado de @/lib/server (build-safe, lazy).
 */

import { db } from '@/lib/server'

export class DatabaseUtils {
  static async testConnection(): Promise<boolean> {
    try {
      await db.$queryRaw`SELECT 1`
      return true
    } catch {
      return false
    }
  }

  static async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy'
    responseTime: number
    error?: string
  }> {
    const start = Date.now()
    try {
      await db.$queryRaw`SELECT 1`
      return { status: 'healthy', responseTime: Date.now() - start }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }
    }
  }

  static async getConnectionInfo() {
    try {
      const result = await db.$queryRaw`SELECT version() as version`
      return {
        connected: true,
        version: Array.isArray(result) && result.length > 0 ? result[0] : 'Unknown',
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    }
  }

  static async getConnectionStats(): Promise<{
    activeConnections: number
    maxConnections: number
    databaseSize: string
  }> {
    try {
      const [connInfo, dbSize] = await Promise.all([
        db.$queryRaw<Array<{ active: string; max: string }>>`
          SELECT
            (SELECT count(*)::text FROM pg_stat_activity WHERE state = 'active') AS active,
            (SELECT setting FROM pg_settings WHERE name = 'max_connections') AS max
        `,
        db.$queryRaw<Array<{ size: string }>>`
          SELECT pg_size_pretty(pg_database_size(current_database())) AS size
        `,
      ])
      return {
        activeConnections: parseInt(connInfo[0]?.active || '0'),
        maxConnections: parseInt(connInfo[0]?.max || '0'),
        databaseSize: dbSize[0]?.size || 'Desconocido',
      }
    } catch {
      return { activeConnections: 0, maxConnections: 0, databaseSize: 'Error' }
    }
  }

  static async getSlowQueries(): Promise<Array<{ query: string; duration: string; state: string }>> {
    try {
      return await db.$queryRaw<Array<{ query: string; duration: string; state: string }>>`
        SELECT query, now() - query_start AS duration, state
        FROM pg_stat_activity
        WHERE state != 'idle'
          AND query != '<IDLE>'
          AND now() - query_start > interval '1 second'
        ORDER BY duration DESC
        LIMIT 10
      `
    } catch {
      return []
    }
  }

  static async cleanupConnections(): Promise<number> {
    try {
      const result = await db.$queryRaw<Array<{ terminated: string }>>`
        SELECT count(*)::text AS terminated
        FROM pg_terminate_backend(pid)
        WHERE pid IN (
          SELECT pid FROM pg_stat_activity
          WHERE state = 'idle'
            AND query_start < now() - interval '1 hour'
            AND pid != pg_backend_pid()
        )
      `
      return parseInt(result[0]?.terminated || '0')
    } catch {
      return 0
    }
  }
}
