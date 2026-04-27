import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Función para calcular tiempo promedio de primera respuesta
async function calculateAvgResponseTime(): Promise<string> {
  try {
    // Obtener tickets con al menos un comentario
    const ticketsWithComments = await prisma.tickets.findMany({
      where: {
        comments: {
          some: {}
        }
      },
      select: {
        id: true,
        createdAt: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true }
        }
      }
    })

    if (ticketsWithComments.length === 0) return '2h'

    // Calcular tiempo promedio de primera respuesta
    const totalMinutes = ticketsWithComments.reduce((acc, ticket) => {
      if (ticket.comments[0]) {
        const diff = ticket.comments[0].createdAt.getTime() - ticket.createdAt.getTime()
        return acc + (diff / (1000 * 60)) // convertir a minutos
      }
      return acc
    }, 0)

    const avgMinutes = totalMinutes / ticketsWithComments.length
    const hours = Math.floor(avgMinutes / 60)
    const minutes = Math.floor(avgMinutes % 60)

    if (hours > 0) return `${hours}h ${minutes > 0 ? minutes + 'min' : ''}`
    return `${minutes}min`
  } catch (error) {
    console.error('Error calculating response time:', error)
    return '2h'
  }
}

// Función para calcular disponibilidad del sistema
async function calculateSystemUptime(): Promise<number> {
  try {
    // Buscar configuración de uptime en system_settings
    const uptimeSetting = await prisma.system_settings.findUnique({
      where: { key: 'system_uptime' }
    })

    if (uptimeSetting) {
      return parseFloat(uptimeSetting.value)
    }

    // Si no existe, calcular basado en tickets procesados vs total
    const now = new Date()
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [totalTickets, processedTickets] = await Promise.all([
      prisma.tickets.count({
        where: { createdAt: { gte: last30Days } }
      }),
      prisma.tickets.count({
        where: {
          createdAt: { gte: last30Days },
          status: { in: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'] }
        }
      })
    ])

    if (totalTickets === 0) return 99.9

    // Calcular uptime basado en tickets procesados
    const uptime = (processedTickets / totalTickets) * 100
    return Math.min(uptime, 99.9) // Cap at 99.9%
  } catch (error) {
    console.error('Error calculating uptime:', error)
    return 99.9
  }
}

// Función para obtener horario de soporte
async function getSupportSchedule() {
  try {
    const scheduleSetting = await prisma.system_settings.findUnique({
      where: { key: 'support_schedule' }
    })

    if (scheduleSetting) {
      return JSON.parse(scheduleSetting.value)
    }

    // Horario por defecto
    return {
      days: 'Lun - Vie',
      hours: '8:00 - 18:00',
      timezone: 'America/Lima'
    }
  } catch (error) {
    console.error('Error getting support schedule:', error)
    return {
      days: 'Lun - Vie',
      hours: '8:00 - 18:00',
      timezone: 'America/Lima'
    }
  }
}

// Función para calcular satisfacción promedio global
async function calculateGlobalSatisfaction() {
  try {
    const ratings = await prisma.ticket_ratings.findMany({
      select: { rating: true },
      take: 10000, // cap de seguridad para el cálculo de promedio
    })

    if (ratings.length === 0) {
      return {
        avgRating: 0,
        totalRatings: 0,
        percentage: 0
      }
    }

    const avgRating = ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length
    const percentage = Math.round((avgRating / 5) * 100)

    return {
      avgRating: Math.round(avgRating * 10) / 10,
      totalRatings: ratings.length,
      percentage
    }
  } catch (error) {
    console.error('Error calculating satisfaction:', error)
    return {
      avgRating: 0,
      totalRatings: 0,
      percentage: 0
    }
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Calcular todas las métricas en paralelo
    const [responseTime, uptime, schedule, satisfaction] = await Promise.all([
      calculateAvgResponseTime(),
      calculateSystemUptime(),
      getSupportSchedule(),
      calculateGlobalSatisfaction()
    ])

    // Determinar estado del tiempo de respuesta
    const responseMinutes = parseInt(responseTime)
    let responseStatus = 'excellent'
    if (responseTime.includes('h')) {
      const hours = parseInt(responseTime)
      if (hours > 4) responseStatus = 'needs_improvement'
      else if (hours > 2) responseStatus = 'good'
    } else if (responseMinutes > 120) {
      responseStatus = 'needs_improvement'
    } else if (responseMinutes > 60) {
      responseStatus = 'good'
    }

    return NextResponse.json({
      responseTime,
      responseStatus,
      uptime: Math.round(uptime * 10) / 10,
      uptimeStatus: uptime >= 99 ? 'excellent' : uptime >= 95 ? 'good' : 'needs_improvement',
      schedule,
      satisfaction: {
        rating: satisfaction.avgRating,
        percentage: satisfaction.percentage,
        totalRatings: satisfaction.totalRatings,
        status: satisfaction.avgRating >= 4.5 ? 'excellent' : satisfaction.avgRating >= 4 ? 'good' : 'needs_improvement'
      },
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching system metrics:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
