import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  assertInventoryResourceRead,
  assertInventoryResourceManage,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { FileService } from '@/lib/services/file-service'

/**
 * GET /api/inventory/equipment/[id]/attachments
 * Lista adjuntos de un equipo
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: equipmentId } = await params

  try {
    await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'EQUIPMENT', equipmentId)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    throw err
  }

  const attachments = await prisma.equipment_attachments.findMany({
    where: { equipmentId },
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(attachments)
}

/**
 * POST /api/inventory/equipment/[id]/attachments
 * Sube un adjunto a un equipo
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: equipmentId } = await params

  // `canManageInventory` por sí solo es un permiso GLOBAL (cualquier gestor
  // de cualquier familia lo tiene en true) — `assertInventoryResourceManage`
  // exige además el scope real de familia sobre ESTE equipo.
  try {
    await assertInventoryResourceManage(
      toInventoryAccessUser(session.user),
      'EQUIPMENT',
      equipmentId
    )
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    throw err
  }

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } })
  if (!equipment) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })

  let attachment
  try {
    attachment = await FileService.uploadEquipmentFile({
      file,
      equipmentId,
      uploadedBy: session.user.id,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al subir el archivo' },
      { status: 400 }
    )
  }

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'EQUIPMENT_ATTACHMENT_UPLOAD',
      entityType: 'equipment',
      entityId: equipmentId,
      userId: session.user.id,
      details: { descripcion: `Archivo adjunto "${file.name}" subido al equipo ${equipment.code}` },
      createdAt: new Date(),
    },
  })

  return NextResponse.json(attachment, { status: 201 })
}
