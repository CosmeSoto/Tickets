/**
 * ENDPOINT DE SALUD DE BASE DE DATOS
 *
 * Proporciona información sobre el estado y performance
 * de la conexión a la base de datos
 */

import { NextRequest, NextResponse } from 'next/server'
import { DatabaseUtils } from '@/lib/database/prisma-enhanced'

export async function GET(request: NextRequest) {
  try {
    // Verificar salud básica de la conexión
    const healthCheck = await DatabaseUtils.checkHealth()

    // Si la base de datos no está saludable, retornar error inmediatamente
    if (healthCheck.status === 'unhealthy') {
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          database: {
            status: healthCheck.status,
            responseTime: healthCheck.responseTime,
            error: healthCheck.error,
          },
        },
        { status: 503 }
      )
    }

    // Obtener estadísticas detalladas solo si la DB está saludable
    const [connectionStats, slowQueries] = await Promise.all([
      DatabaseUtils.getConnectionStats(),
      DatabaseUtils.getSlowQueries(),
    ])

    // Determinar el estado general basado en métricas
    const isHealthy =
      healthCheck.status === 'healthy' &&
      (healthCheck.responseTime || 0) < 1000 &&
      (connectionStats.activeConnections || 0) < (connectionStats.maxConnections || 100) * 0.8

    const response = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: healthCheck.status,
        responseTime: healthCheck.responseTime || 0,
        connections: {
          active: connectionStats.activeConnections || 0,
          max: connectionStats.maxConnections || 100,
          usage: `${Math.round(((connectionStats.activeConnections || 0) / (connectionStats.maxConnections || 100)) * 100)}%`,
        },
        size: 'unknown',
        slowQueries: slowQueries.length,
      },
      // Solo incluir queries lentas si hay alguna
      ...(slowQueries.length > 0 && {
        slowQueriesDetails: slowQueries,
      }),
    }

    // Retornar código 200 para healthy, 206 para degraded
    const statusCode = isHealthy ? 200 : 206

    return NextResponse.json(response, { status: statusCode })
  } catch (error) {
    console.error('Error en health check de base de datos:', error)

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido',
        },
      },
      { status: 503 }
    )
  }
}

// Endpoint para limpiar conexiones inactivas (solo para admins)
export async function POST(request: NextRequest) {
  try {
    // TODO: Agregar autenticación de admin aquí
    // const user = await validateAdmin(request);

    const terminatedConnections = await DatabaseUtils.cleanupConnections()

    return NextResponse.json({
      success: true,
      message: `${terminatedConnections} conexiones inactivas terminadas`,
      terminatedConnections,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error limpiando conexiones:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
