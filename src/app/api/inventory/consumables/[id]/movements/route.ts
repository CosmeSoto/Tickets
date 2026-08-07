import { getSystemBranding } from '@/lib/branding'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConsumableService } from '@/lib/services/consumable.service'
import { createStockMovementSchema } from '@/lib/validations/inventory/consumable'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import prisma from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'
import { randomUUID } from 'crypto'
import {
  assertInventoryResourceManage,
  assertInventoryResourceRead,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

/**
 * GET /api/inventory/consumables/[id]/movements
 * Historial de movimientos de un consumible
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params

    try {
      await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'CONSUMABLE', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

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

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'CONSUMABLE', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }
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
        occurredAt: validatedData.occurredAt ?? null,
      },
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
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

  // Super admins + admin nativo de la familia del consumible
  const admins = await getFamilyScopedAdmins(consumable.consumableType?.familyId ?? null, {
    id: true,
    email: true,
    name: true,
  })

  const title = isOutOfStock
    ? `¡ALERTA! Suministro agotado: ${consumable.name}`
    : `Stock Bajo: ${consumable.name}`

  const message = isOutOfStock
    ? `El suministro "${consumable.name}" se ha agotado (stock: 0). Se requiere reabastecimiento inmediato.`
    : `El suministro "${consumable.name}" tiene stock bajo (${consumable.currentStock}/${consumable.minStock} ${consumable.unitOfMeasure?.symbol || ''}).`

  const { systemName } = await getSystemBranding()

  for (const admin of admins) {
    // Notificación in-app
    await NotificationService.push({
      userId: admin.id,
      type: isOutOfStock ? 'ERROR' : 'WARNING',
      title,
      message,
      metadata: { link: '/inventory?subtype=MRO' },
    }).catch(() => {})

    // Email en cola
    if (!admin.email) continue
    await prisma.email_queue
      .create({
        data: {
          id: randomUUID(),
          toEmail: admin.email,
          subject: title,
          body: generateLowStockEmail(
            consumable,
            admin.name ?? 'Administrador',
            isOutOfStock,
            systemName
          ),
          status: 'pending',
          attempts: 0,
          maxAttempts: 3,
          scheduledAt: new Date(),
        },
      })
      .catch(() => {})
  }
}

function generateLowStockEmail(
  consumable: any,
  adminName: string,
  isOutOfStock: boolean,
  systemName: string
): string {
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
      <p>${
        isOutOfStock
          ? `El suministro <strong>"${consumable.name}"</strong> se ha <strong>agotado completamente</strong>. Se requiere reabastecimiento inmediato.`
          : `El suministro <strong>"${consumable.name}"</strong> tiene <strong>stock por debajo del mínimo</strong>.`
      }</p>
      <div class="info-box">
        <p><strong>Suministro:</strong> ${consumable.name}</p>
        <p><strong>Tipo:</strong> ${consumable.consumableType?.name || 'N/A'}</p>
        <p><strong>Stock actual:</strong> ${consumable.currentStock} ${consumable.unitOfMeasure?.symbol || ''}</p>
        <p><strong>Stock mínimo:</strong> ${consumable.minStock} ${consumable.unitOfMeasure?.symbol || ''}</p>
        <p><strong>Stock máximo:</strong> ${consumable.maxStock} ${consumable.unitOfMeasure?.symbol || ''}</p>
        ${consumable.costPerUnit ? `<p><strong>Costo por unidad:</strong> $${consumable.costPerUnit}</p>` : ''}
      </div>
      <p style="text-align: center;">
        <a href="${process.env.NEXTAUTH_URL}/inventory?subtype=MRO" class="button">Ver Suministros</a>
      </p>
    </div>
    <div class="footer"><p>Mensaje automático del ${systemName}</p></div>
  </div>
</body>
</html>`.trim()
}
