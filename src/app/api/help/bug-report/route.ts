import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      severity,
      browser,
      os,
      steps,
      expected,
      actual,
      additional
    } = body

    // Validar campos requeridos
    if (!title || !severity || !steps || !expected || !actual) {
      return NextResponse.json({ 
        success: false,
        error: 'Faltan campos requeridos' 
      }, { status: 400 })
    }

    // Buscar categoría de "Bugs" o crear una por defecto
    let bugCategory = await prisma.categories.findFirst({
      where: {
        name: {
          contains: 'Bug',
          mode: 'insensitive'
        }
      }
    })

    if (!bugCategory) {
      // Crear categoría de bugs si no existe
      bugCategory = await prisma.categories.create({
        data: {
          id: randomUUID(),
          name: 'Reportes de Bugs',
          description: 'Reportes de problemas técnicos y errores del sistema',
          level: 1,
          color: '#EF4444',
          order: 999,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }

    // Crear ticket para el reporte de bug
    const description = `
**Información del Sistema:**
- Navegador: ${browser || 'No especificado'}
- Sistema Operativo: ${os || 'No especificado'}

**Pasos para Reproducir:**
${steps}

**Resultado Esperado:**
${expected}

**Resultado Actual:**
${actual}

${additional ? `**Información Adicional:**\n${additional}` : ''}

---
*Reporte generado automáticamente desde el sistema de ayuda*
    `.trim()

    const ticket = await prisma.tickets.create({
      data: {
        id: randomUUID(),
        title: `[BUG] ${title}`,
        description,
        priority: severity === 'CRITICAL' ? 'URGENT' : 
                 severity === 'HIGH' ? 'HIGH' :
                 severity === 'MEDIUM' ? 'MEDIUM' : 'LOW',
        status: 'OPEN',
        source: 'WEB',
        clientId: session.user.id,
        categoryId: bugCategory.id,
        tags: ['bug-report', 'help-system', severity.toLowerCase()],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        users_tickets_clientIdTousers: true,
        categories: true
      }
    })

    // El sistema de notificaciones automáticamente detectará este ticket crítico
    // y generará alertas para los administradores

    return NextResponse.json({
      success: true,
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.id.slice(-8).toUpperCase()
      },
      message: 'Reporte de bug enviado exitosamente. Se ha creado un ticket para dar seguimiento.'
    })
  } catch (error) {
    console.error('Error creating bug report:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}