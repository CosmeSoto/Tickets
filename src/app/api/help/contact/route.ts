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
      subject,
      category,
      priority,
      message
    } = body

    // Validar campos requeridos
    if (!subject || !category || !priority || !message) {
      return NextResponse.json({ 
        success: false,
        error: 'Faltan campos requeridos' 
      }, { status: 400 })
    }

    // Mapear categorías a categorías existentes o crear una por defecto
    const categoryMap: { [key: string]: string } = {
      'technical': 'Soporte Técnico',
      'account': 'Cuenta y Acceso',
      'billing': 'Facturación',
      'feature': 'Solicitudes de Funciones',
      'other': 'Consultas Generales'
    }

    const categoryName = categoryMap[category] || 'Consultas Generales'

    // Buscar o crear la categoría
    let ticketCategory = await prisma.categories.findFirst({
      where: {
        name: {
          contains: categoryName,
          mode: 'insensitive'
        }
      }
    })

    if (!ticketCategory) {
      ticketCategory = await prisma.categories.create({
        data: {
          id: randomUUID(),
          name: categoryName,
          description: `Tickets de ${categoryName.toLowerCase()}`,
          level: 1,
          color: '#3B82F6',
          order: 100,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    // Crear ticket para la consulta de soporte
    const description = `
**Categoría:** ${categoryName}
**Prioridad:** ${priority.toUpperCase()}

**Mensaje:**
${message}

---
*Consulta enviada desde el sistema de ayuda*
    `.trim()

    const ticket = await prisma.tickets.create({
      data: {
        id: randomUUID(),
        title: `[SOPORTE] ${subject}`,
        description,
        priority: priority.toUpperCase() as any,
        status: 'OPEN',
        source: 'WEB',
        clientId: session.user.id,
        categoryId: ticketCategory.id,
        tags: ['help-system', 'support-request', category],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        users_tickets_clientIdTousers: true,
        categories: true
      }
    })

    // El sistema de notificaciones automáticamente detectará este nuevo ticket
    // y generará alertas para los técnicos apropiados

    return NextResponse.json({
      success: true,
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.id.slice(-8).toUpperCase()
      },
      message: 'Tu consulta ha sido enviada exitosamente. Te responderemos pronto.'
    })
  } catch (error) {
    console.error('Error creating support request:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}