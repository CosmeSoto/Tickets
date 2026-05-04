import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { canManageInventory, canManageAsset } from '@/lib/inventory-access'

/**
 * POST /api/inventory/equipment/[id]/convert-to-purchase
 *
 * Convierte un equipo arrendado (RENTAL) o de tercero (LOAN) en activo propio (FIXED_ASSET).
 * Caso de uso: la empresa decide comprar el equipo al arrendador/propietario.
 *
 * Cambios que aplica:
 *   - ownershipType + acquisitionMode: RENTAL|LOAN → FIXED_ASSET
 *   - Registra precio de compra, fecha, factura y proveedor
 *   - Activa campos de depreciación si se proporcionan
 *   - Conserva los campos de arrendamiento como historial (no los borra)
 *   - Genera entrada en audit_logs con acción CONVERT_TO_PURCHASE
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return NextResponse.json(
        { error: 'No tienes permiso para gestionar el inventario' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Cargar equipo actual
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        brand: true,
        model: true,
        ownershipType: true,
        acquisitionMode: true,
        rentalProvider: true,
        rentalMonthlyCost: true,
        supplierId: true,
        type: { select: { familyId: true } },
      },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
    }

    // Solo se puede convertir desde RENTAL o LOAN
    if (equipment.ownershipType === 'FIXED_ASSET') {
      return NextResponse.json(
        { error: 'Este equipo ya es un activo propio (FIXED_ASSET). No requiere conversión.' },
        { status: 409 }
      )
    }

    // Verificar acceso a la familia del activo
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const assetFamilyId = equipment.type?.familyId ?? null
    const allowed = await canManageAsset(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      assetFamilyId
    )
    if (!allowed) {
      return NextResponse.json(
        { error: 'No tienes permiso para modificar este equipo' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      purchasePrice,
      purchaseDate,
      invoiceNumber,
      supplierId,
      usefulLifeYears,
      residualValue,
      depreciationMethod,
      notes,
    } = body as {
      purchasePrice?: number
      purchaseDate?: string
      invoiceNumber?: string
      supplierId?: string
      usefulLifeYears?: number
      residualValue?: number
      depreciationMethod?: string
      notes?: string
    }

    // Precio de compra es obligatorio para la conversión
    if (!purchasePrice || purchasePrice <= 0) {
      return NextResponse.json(
        { error: 'El precio de compra es obligatorio para registrar la adquisición' },
        { status: 400 }
      )
    }

    // Validar residualValue <= purchasePrice
    if (residualValue !== undefined && residualValue > purchasePrice) {
      return NextResponse.json(
        { error: 'El valor residual no puede ser mayor al precio de compra' },
        { status: 400 }
      )
    }

    const previousOwnershipType = equipment.ownershipType

    // Actualizar el equipo
    const updated = await prisma.equipment.update({
      where: { id },
      data: {
        ownershipType: 'FIXED_ASSET',
        acquisitionMode: 'FIXED_ASSET',
        purchasePrice,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        invoiceNumber: invoiceNumber ?? undefined,
        supplierId: supplierId ?? equipment.supplierId ?? undefined,
        usefulLifeYears: usefulLifeYears ?? undefined,
        residualValue: residualValue ?? 0,
        depreciationMethod: (depreciationMethod as any) ?? 'LINEAR',
        notes: notes
          ? `${notes}\n\n[Convertido desde ${previousOwnershipType === 'RENTAL' ? 'arrendamiento' : 'activo de tercero'} el ${new Date().toLocaleDateString('es-EC')}]`
          : `[Convertido desde ${previousOwnershipType === 'RENTAL' ? 'arrendamiento' : 'activo de tercero'} el ${new Date().toLocaleDateString('es-EC')}]`,
      },
    })

    // Audit log con acción específica
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'CONVERT_TO_PURCHASE',
        entityType: 'equipment',
        entityId: id,
        userId: session.user.id,
        userEmail: session.user.email,
        details: {
          code: equipment.code,
          asset: `${equipment.brand} ${equipment.model}`,
          previousOwnershipType,
          newOwnershipType: 'FIXED_ASSET',
          purchasePrice,
          purchaseDate: purchaseDate ?? new Date().toISOString(),
          invoiceNumber: invoiceNumber ?? null,
          supplierId: supplierId ?? equipment.supplierId ?? null,
          usefulLifeYears: usefulLifeYears ?? null,
          depreciationMethod: depreciationMethod ?? 'LINEAR',
          convertedBy: session.user.email,
        },
      },
    })

    return NextResponse.json({
      success: true,
      equipment: updated,
      message: `Equipo convertido a activo propio exitosamente.`,
    })
  } catch (error) {
    console.error('[convert-to-purchase] Error:', error)
    return NextResponse.json({ error: 'Error al convertir el equipo' }, { status: 500 })
  }
}
