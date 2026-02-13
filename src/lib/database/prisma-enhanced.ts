/**
 * Utilidades mejoradas para Prisma
 */

import { PrismaClient } from '@prisma/client'

export class DatabaseUtils {
  private static prisma: PrismaClient

  static getInstance(): PrismaClient {
    if (!DatabaseUtils.prisma) {
      DatabaseUtils.prisma = new PrismaClient()
    }
    return DatabaseUtils.prisma
  }

  static async testConnection(): Promise<boolean> {
    try {
      const prisma = DatabaseUtils.getInstance()
      await prisma.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('Database connection test failed:', error)
      return false
    }
  }

  static async checkHealth() {
    try {
      const prisma = DatabaseUtils.getInstance()
      const startTime = Date.now()
      await prisma.$queryRaw`SELECT 1`
      const responseTime = Date.now() - startTime
      
      return {
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  static async getConnectionInfo() {
    try {
      const prisma = DatabaseUtils.getInstance()
      const result = await prisma.$queryRaw`SELECT version() as version`
      return {
        connected: true,
        version: Array.isArray(result) && result.length > 0 ? result[0] : 'Unknown',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  static async getConnectionStats() {
    try {
      const prisma = DatabaseUtils.getInstance()
      // Estadísticas básicas de conexión
      return {
        activeConnections: 1, // Prisma maneja esto internamente
        maxConnections: 100,  // Valor por defecto
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  static async getSlowQueries() {
    try {
      // En un entorno real, esto consultaría logs de queries lentas
      return []
    } catch (error) {
      return []
    }
  }

  static async cleanupConnections() {
    try {
      // En un entorno real, esto limpiaría conexiones inactivas
      return { terminated: 0 }
    } catch (error) {
      return { terminated: 0, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async disconnect() {
    if (DatabaseUtils.prisma) {
      await DatabaseUtils.prisma.$disconnect()
    }
  }
}