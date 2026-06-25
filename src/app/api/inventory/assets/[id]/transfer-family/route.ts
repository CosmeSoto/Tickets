import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { getAccessibleFamilyIds, checkFamilyManageAccess } from '@/lib/inventory/family-access'
import { canManageInventory } from '@/lib/inventory-access'

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetKind = 'EQUIPMENT' | 'LICENSE' | 'MRO'

interface CustomValueEntry {
  fieldName: string
  fieldValue: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Detecta el subtipo del activo y su familia origen a partir del ID.
 * Devuelve null si el activo no existe en ninguna tabla.
 */
async function resolveAsset(id: string): Promise<{
  kind: AssetKind
  currentTypeId: string
  currentFamilyId: string | null
  currentFamilyName: string | null
  label: string
  status?: string
  hasActiveAssignment: boolean
} | null> {
  // Equipo
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    select: {
      code: true,
      brand: true,
      modelDeprecated: true,
      status: true,
      typeId: true,
      type: {
        select: {
          familyId: true,
          family: { select: { name: true } },
        },
      },
      assignments: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  })
  if (equipment) {
    return {
      kind: 'EQUIPMENT',
      currentTypeId: equipment.typeId,
      currentFamilyId: equipment.type?.familyId ?? null,
      currentFamilyName: equipment.type?.family?.name ?? null,
      label: `${equipment.brand} ${equipment.modelDeprecated} (${equipment.code})`,
      status: equipment.status,
      hasActiveAssignment: equipment.assignments.length > 0,
    }
  }

  // Licencia
  const license = await prisma.software_licenses.findUnique({
    where: { id },
    select: {
      name: true,
      typeId: true,
      licenseType: {
        select: {
          familyId: true,
          family: { select: { name: true } },
        },
      },
    },
  })
  if (license) {
    return {
      kind: 'LICENSE',
      currentTypeId: license.typeId,
      currentFamilyId: license.licenseType?.familyId ?? null,
      currentFamilyName: license.licenseType?.family?.name ?? null,
      label: license.name,
      hasActiveAssignment: false,
    }
  }

  // MRO / Consumible
  const consumable = await prisma.consumables.findUnique({
    where: { id },
    select: {
      name: true,
      typeId: true,
      consumableType: {
        select: {
          familyId: true,
          family: { select: { name: true } },
        },
      },
    },
  })
  if (consumable) {
    return {
      kind: 'MRO',
      currentTypeId: consumable.typeId ?? '',
      currentFamilyId: consumable.consumableType?.familyId ?? null,
      currentFamilyName: consumable.consumableType?.family?.name ?? null,
      label: consumable.name,
      hasActiveAssignment: false,
    }
  }

  return null
}

/**
 * Lee los customValues actuales del activo normalizados como array.
 */
async function readCurrentCustomValues(
  id: string,
  kind: AssetKind
): Promise<CustomValueEntry[]> {
  if (kind === 'EQUIPMENT') {
    const rows = await prisma.equipment_custom_values.findMany({
      where: { equipmentId: id },
      select: { fieldName: true, fieldValue: true },
    })
    return rows
  }

  if (kind === 'LICENSE') {
    const lic = await prisma.software_licenses.findUnique({
      where: { id },
      select: { customValues: true } as any,
    })
    const raw = (lic as any)?.customValues
    if (!raw || !Array.isArray(raw)) return []
    return (raw as unknown as CustomValueEntry[]).filter(
      v => typeof v?.fieldName === 'string' && typeof v?.fieldValue === 'string'
    )
  }

  if (kind === 'MRO') {
    const c = await prisma.consumables.findUnique({
      where: { id },
      select: { customValues: true },
    })
    const raw = c?.customValues
    if (!raw || !Array.isArray(raw)) return []
    return (raw as unknown as CustomValueEntry[]).filter(
      v => typeof v?.fieldName === 'string' && typeof v?.fieldValue === 'string'
    )
  }

  return []
}

/**
 * Lee los nombres de atributos definidos para un tipo destino.
 */
async function getTargetTypeAttributeNames(
  typeId: string,
  kind: AssetKind
): Promise<string[]> {
  if (kind === 'EQUIPMENT') {
    const attrs = await prisma.equipment_type_attributes.findMany({
      where: { equipmentTypeId: typeId },
      select: { attributeName: true },
    })
    return attrs.map(a => a.attributeName)
  }

  if (kind === 'LICENSE') {
    const attrs = await (prisma as any).license_type_attributes.findMany({
      where: { licenseTypeId: typeId },
      select: { attributeName: true },
    })
    return attrs.map((a: any) => a.attributeName)
  }

  if (kind === 'MRO') {
    const attrs = await (prisma as any).consumable_type_attributes.findMany({
      where: { consumableTypeId: typeId },
      select: { attributeName: true },
    })
    return attrs.map((a: any) => a.attributeName)
  }

  return []
}

/**
 * Escribe los customValues migrados en la tabla/campo correspondiente.
 */
async function persistMigratedCustomValues(
  id: string,
  kind: AssetKind,
  values: CustomValueEntry[],
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<void> {
  if (kind === 'EQUIPMENT') {
    await tx.equipment_custom_values.deleteMany({ where: { equipmentId: id } })
    if (values.length > 0) {
      await tx.equipment_custom_values.createMany({
        data: values.map(v => ({
          id: randomUUID(),
          equipmentId: id,
          fieldName: v.fieldName,
          fieldValue: v.fieldValue,
        })),
      })
    }
    return
  }

  if (kind === 'LICENSE') {
    await (tx.software_licenses.update as any)({
      where: { id },
      data: { customValues: values.length > 0 ? values : null },
    })
    return
  }

  if (kind === 'MRO') {
    await (tx.consumables.update as any)({
      where: { id },
      data: { customValues: values.length > 0 ? values : null },
    })
  }
}

// ─── GET — preview del impacto antes de confirmar ────────────────────────────

/**
 * GET /api/inventory/assets/[id]/transfer-family?targetFamilyId=...&targetTypeId=...
 *
 * Devuelve:
 *  - atributos del activo actual
 *  - atributos que se conservarán en el tipo destino (intersección por fieldName)
 *  - atributos que se perderán (en origen pero no en destino)
 *  - atributos nuevos vacíos (en destino pero no en origen)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    if (session.user.role !== 'ADMIN' && !(await canManageInventory(session.user.id, session.user.role))) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const targetTypeId = searchParams.get('targetTypeId')
    if (!targetTypeId) {
      return NextResponse.json({ error: 'targetTypeId es requerido' }, { status: 400 })
    }

    const asset = await resolveAsset(id)
    if (!asset) {
      return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })
    }

    // Verificar acceso a familia origen
    const accessible = await getAccessibleFamilyIds(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      await canManageInventory(session.user.id, session.user.role)
    )
    if (accessible !== undefined && asset.currentFamilyId && !accessible.includes(asset.currentFamilyId)) {
      return NextResponse.json({ error: 'Sin acceso a la familia de origen' }, { status: 403 })
    }

    const currentValues = await readCurrentCustomValues(id, asset.kind)
    const targetAttrNames = await getTargetTypeAttributeNames(targetTypeId, asset.kind)

    const currentMap = new Map(currentValues.map(v => [v.fieldName, v.fieldValue]))

    const preserved: CustomValueEntry[] = []
    const lost: string[] = []
    const newEmpty: string[] = []

    // Atributos actuales
    for (const [name, value] of currentMap) {
      if (targetAttrNames.includes(name)) {
        preserved.push({ fieldName: name, fieldValue: value })
      } else {
        lost.push(name)
      }
    }

    // Atributos del tipo destino sin valor
    for (const name of targetAttrNames) {
      if (!currentMap.has(name)) {
        newEmpty.push(name)
      }
    }

    return NextResponse.json({
      assetKind: asset.kind,
      currentFamilyId: asset.currentFamilyId,
      currentFamilyName: asset.currentFamilyName,
      hasActiveAssignment: asset.hasActiveAssignment,
      impact: {
        preserved,
        lost,
        newEmpty,
      },
    })
  } catch (error) {
    console.error('[GET transfer-family]', error)
    return NextResponse.json({ error: 'Error al calcular impacto' }, { status: 500 })
  }
}

// ─── POST — ejecutar la transferencia ────────────────────────────────────────

/**
 * POST /api/inventory/assets/[id]/transfer-family
 *
 * Body:
 *  targetFamilyId   string   — familia destino
 *  targetTypeId     string   — tipo del activo en la familia destino
 *  targetWarehouseId? string — bodega destino (solo equipos)
 *  preservedValues  CustomValueEntry[] — atributos a conservar (puede incluir valores editados)
 *  force?           boolean  — confirmar pérdida de atributos
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const canManage = await canManageInventory(session.user.id, session.user.role)

    if (session.user.role !== 'ADMIN' && !canManage) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json()
    const { targetFamilyId, targetTypeId, targetWarehouseId, preservedValues, force } = body as {
      targetFamilyId: string
      targetTypeId: string
      targetWarehouseId?: string
      preservedValues?: CustomValueEntry[]
      force?: boolean
    }

    if (!targetFamilyId || !targetTypeId) {
      return NextResponse.json(
        { error: 'targetFamilyId y targetTypeId son requeridos' },
        { status: 400 }
      )
    }

    // ── Resolver activo ──────────────────────────────────────────────────────
    const asset = await resolveAsset(id)
    if (!asset) {
      return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })
    }

    // ── Verificar acceso operativo a familia ORIGEN y DESTINO ───────────────
    if (asset.currentFamilyId) {
      const canManageSource = await checkFamilyManageAccess(
        session.user.id,
        asset.currentFamilyId,
        session.user.role,
        isSuperAdmin,
        canManage
      )
      if (!canManageSource) {
        return NextResponse.json(
          { error: 'No tienes permiso para transferir activos desde esta familia' },
          { status: 403 }
        )
      }
    }

    const canManageTarget = await checkFamilyManageAccess(
      session.user.id,
      targetFamilyId,
      session.user.role,
      isSuperAdmin,
      canManage
    )
    if (!canManageTarget) {
      return NextResponse.json(
        { error: 'No tienes permiso para transferir activos a esta familia' },
        { status: 403 }
      )
    }

    // ── Restricción: equipo con asignación activa ────────────────────────────
    if (asset.kind === 'EQUIPMENT' && asset.hasActiveAssignment) {
      return NextResponse.json(
        {
          error:
            'No se puede transferir un equipo con asignación activa. Termina la asignación primero.',
          code: 'ACTIVE_ASSIGNMENT',
        },
        { status: 409 }
      )
    }

    // ── No transferir a la misma familia ────────────────────────────────────
    if (asset.currentFamilyId === targetFamilyId) {
      return NextResponse.json(
        { error: 'El activo ya pertenece a esa familia' },
        { status: 400 }
      )
    }

    // ── Validar que el tipo destino pertenece a la familia destino ───────────
    const typeValid = await validateTypeInFamily(targetTypeId, asset.kind, targetFamilyId)
    if (!typeValid) {
      return NextResponse.json(
        { error: 'El tipo seleccionado no pertenece a la familia destino' },
        { status: 422 }
      )
    }

    // ── Calcular atributos que se perderán ───────────────────────────────────
    const currentValues = await readCurrentCustomValues(id, asset.kind)
    const targetAttrNames = await getTargetTypeAttributeNames(targetTypeId, asset.kind)
    const lost = currentValues
      .filter(v => !targetAttrNames.includes(v.fieldName))
      .map(v => v.fieldName)

    if (lost.length > 0 && !force) {
      return NextResponse.json(
        {
          error: 'Se perderán atributos al transferir',
          code: 'ATTRIBUTES_WILL_BE_LOST',
          lost,
          message: `Se perderán ${lost.length} atributo(s): ${lost.join(', ')}. Envía force=true para confirmar.`,
        },
        { status: 409 }
      )
    }

    // ── Determinar los valores a persistir ───────────────────────────────────
    // Usa los valores que el cliente envió (puede haberlos editado en el modal)
    // filtrados solo a los que tienen un attributeName válido en el tipo destino.
    const valuesToPersist: CustomValueEntry[] = (
      preservedValues ?? currentValues.filter(v => targetAttrNames.includes(v.fieldName))
    ).filter(v => targetAttrNames.includes(v.fieldName))

    // ── Transacción ──────────────────────────────────────────────────────────
    const oldFamilyId = asset.currentFamilyId
    const oldTypeId = asset.currentTypeId

    // Obtener nombre de la familia destino para el audit_log
    const targetFamily = await prisma.families.findUnique({
      where: { id: targetFamilyId },
      select: { name: true },
    })
    const targetFamilyName = targetFamily?.name ?? targetFamilyId

    await prisma.$transaction(async tx => {
      if (asset.kind === 'EQUIPMENT') {
        // Determinar bodega destino
        let resolvedWarehouseId: string | null = targetWarehouseId ?? null

        if (!resolvedWarehouseId) {
          // Intentar bodega por defecto de la familia destino
          const defaultWH = await tx.warehouses.findFirst({
            where: { familyId: targetFamilyId, isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          })
          resolvedWarehouseId = defaultWH?.id ?? null
        }

        await (tx.equipment.update as any)({
          where: { id },
          data: {
            typeId: targetTypeId,
            // Limpiar departamento — puede no pertenecer a la nueva familia
            departmentId: null,
            // Actualizar bodega si hay una en la familia destino
            ...(resolvedWarehouseId ? { warehouseId: resolvedWarehouseId } : {}),
          },
        })
      } else if (asset.kind === 'LICENSE') {
        await tx.software_licenses.update({
          where: { id },
          data: { typeId: targetTypeId },
        })
      } else if (asset.kind === 'MRO') {
        await tx.consumables.update({
          where: { id },
          data: { typeId: targetTypeId, warehouseId: null },
        })
      }

      // Persistir customValues migrados
      await persistMigratedCustomValues(id, asset.kind, valuesToPersist, tx as any)

      // Auditoría
      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'ASSET_FAMILY_TRANSFER',
          entityType: asset.kind.toLowerCase(),
          entityId: id,
          userId: session.user.id,
          details: {
            assetLabel: asset.label,
            fromFamilyId: oldFamilyId,
            fromFamilyName: asset.currentFamilyName ?? oldFamilyId,
            toFamilyId: targetFamilyId,
            toFamilyName: targetFamilyName,
            fromTypeId: oldTypeId,
            toTypeId: targetTypeId,
            attributesPreserved: valuesToPersist.length,
            attributesLost: lost,
            transferredBy: session.user.email ?? session.user.id,
          },
        },
      })
    })

    return NextResponse.json({
      success: true,
      assetId: id,
      assetKind: asset.kind,
      fromFamilyId: oldFamilyId,
      fromFamilyName: asset.currentFamilyName,
      toFamilyId: targetFamilyId,
      attributesPreserved: valuesToPersist.length,
      attributesLost: lost,
    })
  } catch (error) {
    console.error('[POST transfer-family]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al transferir activo' },
      { status: 500 }
    )
  }
}

// ─── Helper privado ───────────────────────────────────────────────────────────

async function validateTypeInFamily(
  typeId: string,
  kind: AssetKind,
  familyId: string
): Promise<boolean> {
  if (kind === 'EQUIPMENT') {
    const t = await prisma.equipment_types.findUnique({
      where: { id: typeId },
      select: { familyId: true },
    })
    return t?.familyId === familyId
  }
  if (kind === 'LICENSE') {
    const t = await prisma.license_types.findUnique({
      where: { id: typeId },
      select: { familyId: true },
    })
    return t?.familyId === familyId
  }
  if (kind === 'MRO') {
    const t = await prisma.consumable_types.findUnique({
      where: { id: typeId },
      select: { familyId: true },
    })
    return t?.familyId === familyId
  }
  return false
}
