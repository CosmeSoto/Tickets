import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConsumableService } from '@/lib/services/consumable.service'
import { createStockMovementSchema } from '@/lib/validations/inventory/consumable'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * GET /api/inventory/consumables/[id]/movements
 * Historial de movimientos de un consumible
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
    const movements = await ConsumableService.getConsumableMovements(id, limit)

    return NextResponse.json({ movements })
  } catch (error) {
    console.error('Error en GET /api/inventory/consumables/[id]/movements:', error)
    return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 })
  }
}


/**
 * POST /api/inventory/consumables/[id]/movements
 * Registra un movimiento de stock y verifica alertas de stock bajo
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = createStockMovementSchema.parse({
      ...body,
      consumableId: id,
    })

    const movement = await ConsumableService.createStockMovement(validatedData, session.user.id)

    // Auditoría del movimiento
    await AuditServiceComplete.log({
      action: AuditActionsComplete.STOCK_MOVEMENT_CREATED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: {
        movementType: validatedData.type,
        quantity: validatedData.quantity,
        reason: validatedData.reason,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando movimiento de stock:', err))

    // Verificar stock bajo después del movimiento y notificar si es necesario
    checkLowStockAndNotify(id).catch(err =>
      console.error('[NOTIFICATION] Error verificando stock bajo:', err)
    )

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/inventory/consumables/[id]/movements:', error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error) {
      const isStockError = error.message === 'Stock insuficiente para realizar la salida'
      return NextResponse.json({ error: error.message }, { status: isStockError ? 422 : 400 })
    }
    return NextResponse.json({ error: 'Error al registrar movimiento' }, { status: 500 })
  }
}

/**
 * Verifica si el consumible tiene stock bajo/agotado y envía notificaciones + emails a admins
 */
async function checkLowStockAndNotify(consumableId: string) {
  const consumable = await prisma.consumables.findUnique({
    where: { id: consumableId },
    include: { consumableType: true, unitOfMeasure: true },
  })

  if (!consumable) return

  const isLowStock = consumable.currentStock <= consumable.minStock
  const isOutOfStock = consumable.currentStock === 0

  if (!isLowStock) return

  // Obtener admins
  const admins = await prisma.users.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, name: true },
  })

  const title = isOutOfStock
    ? `¡ALERTA! Consumible Agotado: ${consumable.name}`
    : `Stock Bajo: ${consumable.name}`

  const message = isOutOfStock
    ? `El consumible "${consumable.name}" se ha agotado (stock: 0). Se requiere reabastecimiento inmediato.`
    : `El consumible "${consumable.name}" tiene stock bajo (${consumable.currentStock}/${consumable.minStock} ${consumable.unitOfMeasure?.symbol || ''}).`

  for (const admin of admins) {
    // Notificación in-app
    await prisma.notifications.create({
      data: {
        id: randomUUID(),
        userId: admin.id,
        type: isOutOfStock ? 'ERROR' : 'WARNING',
        title,
        message,
        metadata: { link: '/inventory/consumables' },
        isRead: false,
      },
    }).catch(() => {})

    // Email en cola
    await prisma.email_queue.create({
      data: {
        id: randomUUID(),
        toEmail: admin.email,
        subject: title,
        body: generateLowStockEmail(consumable, admin.name, isOutOfStock),
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        scheduledAt: new Date(),
      },
    }).catch(() => {})
  }
}

function generateLowStockEmail(consumable: any, adminName: string, isOutOfStock: boolean): string {
  const bgColor = isOutOfStock ? '#dc2626' : '#f59e0b'
  const icon = isOutOfStock ? '🚨' : '⚠️'
  const urgency = isOutOfStock ? 'AGOTADO' : 'STOCK BAJO'

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background-color: ${bgColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
  .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
  .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${bgColor}; }
  .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; }
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h2>${icon} ${urgency}: ${consumable.name}</h2></div>
    <div class="content">
      <p>Hola ${adminName},</p>
      <p>${isOutOfStock
        ? `El consumible <strong>"${consumable.name}"</strong> se ha <strong>agotado completamente</strong>. Se requiere reabastecimiento inmediato.`
        : `El consumible <strong>"${consumable.name}"</strong> tiene <strong>stock por debajo del mínimo</strong>.`
      }</p>
      <div class="info-box">
        <p><strong>Consumible:</strong> ${consumable.name}</p>
        <p><strong>Tipo:</strong> ${consumable.consumableType?.name || 'N/A'}</p>
        <p><strong>Stock actual:</strong> ${consumable.currentStock} ${consumable.unitOfMeasure?.symbol || ''}</p>
        <p><strong>Stock mínimo:</strong> ${consumable.minStock} ${consumable.unitOfMeasure?.symbol || ''}</p>
        <p><strong>Stock máximo:</strong> ${consumable.maxStock} ${consumable.unitOfMeasure?.symbol || ''}</p>
        ${consumable.costPerUnit ? `<p><strong>Costo por unidad:</strong> $${consumable.costPerUnit}</p>` : ''}
      </div>
      <p style="text-align: center;">
        <a href="${process.env.NEXTAUTH_URL}/inventory/consumables" class="button">Ver Consumibles</a>
      </p>
    </div>
    <div class="footer"><p>Mensaje automático del Sistema de Gestión de Inventario</p></div>
  </div>
</body>
</html>`.trim()
}
