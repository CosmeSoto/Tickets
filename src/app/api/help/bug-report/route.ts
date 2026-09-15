import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationService } from '@/lib/services/notification-service'
import { SLAService } from '@/lib/services/sla-service'
import { resolveInitialPriority } from '@/lib/tickets/priority-triage'
import { TicketPriority } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { title, severity, browser, os, steps, expected, actual, additional } = body

    // Validar campos requeridos
    if (!title || !severity || !steps || !expected || !actual) {
      return NextResponse.json(
        {
          success: false,
          error: 'Faltan campos requeridos',
        },
        { status: 400 }
      )
    }

    // Buscar categoría de "Bugs" o crear una por defecto
    let bugCategory = await prisma.categories.findFirst({
      where: {
        name: {
          contains: 'Bug',
          mode: 'insensitive',
        },
      },
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
        },
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

    const severityPriority: TicketPriority =
      severity === 'CRITICAL'
        ? 'URGENT'
        : severity === 'HIGH'
          ? 'HIGH'
          : severity === 'MEDIUM'
            ? 'MEDIUM'
            : 'LOW'

    const { priority: resolvedPriority, requestedPriority } = resolveInitialPriority(
      session.user.role,
      severityPriority,
      bugCategory.priorityCeiling
    )

    const ticket = await prisma.tickets.create({
      data: {
        id: randomUUID(),
        title: `[BUG] ${title}`,
        description,
        priority: resolvedPriority,
        ...(requestedPriority ? { requestedPriority } : {}),
        status: 'OPEN',
        source: 'WEB',
        clientId: session.user.id,
        categoryId: bugCategory.id,
        tags: ['bug-report', 'help-system', severity.toLowerCase()],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        users_tickets_clientIdTousers: true,
        categories: true,
      },
    })

    // Este ticket se crea con `prisma.tickets.create` directo (no vía
    // /api/tickets), así que no hereda su SLA/notificación automáticamente —
    // se disparan ambos aquí explícitamente. Sin familyId (la categoría
    // "Reportes de Bugs" no pertenece a ninguna), notifyTicketCreated cae al
    // fallback de "solo super admins" (getTicketOversightAdmins incluye
    // siempre a los super admins, con o sin familia), que es quien debe
    // triar un reporte de bug del sistema.
    await SLAService.assignSLA(ticket.id).catch(err => {
      console.error('[SLA] Error asignando SLA a reporte de bug:', err)
    })
    await NotificationService.notifyTicketCreated(ticket.id).catch(err => {
      console.error('[NOTIFICATION] Error notificando reporte de bug:', err)
    })

    return NextResponse.json({
      success: true,
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.id.slice(-8).toUpperCase(),
      },
      message: 'Reporte de bug enviado exitosamente. Se ha creado un ticket para dar seguimiento.',
    })
  } catch (error) {
    console.error('Error creating bug report:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
