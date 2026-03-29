import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { getUploadDir } from '@/lib/upload-path'
import { FolioService } from '@/lib/services/folio.service'

const decommissionInclude = {
  requester: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true, email: true } },
  equipment: { select: { id: true, code: true, brand: true, model: true, serialNumber: true, status: true } },
  license: { select: { id: true, name: true, vendor: true } },
  attachments: true,
  act: { select: { id: true, folio: true, pdfPath: true, approvedAt: true } },
}

/**
 * GET /api/inventory/decommission-acts
 * ADMIN ve todas; Gestor/Técnico ve solo las propias
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const isAdmin = session.user.role === 'ADMIN'
  const canManage = await canManageInventory(session.user.id, session.user.role)
  if (!isAdmin && !canManage && session.user.role !== 'TECHNICIAN') {
    return NextResponse.json({ error: 'No tienes permiso para ver solicitudes de baja' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const status = sp.get('status') || undefined
  const assetType = sp.get('assetType') || undefined
  const page = parseInt(sp.get('page') || '1')
  const limit = parseInt(sp.get('limit') || '20')

  const where: any = {}
  if (!isAdmin) where.requestedById = session.user.id
  if (status) where.status = status
  if (assetType) where.assetType = assetType

  const [requests, total] = await Promise.all([
    prisma.decommission_requests.findMany({
      where,
      include: decommissionInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.decommission_requests.count({ where }),
  ])

  return NextResponse.json({ requests, total, page, limit })
}

/**
 * POST /api/inventory/decommission-acts
 * Crear solicitud de baja
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const isAdmin = session.user.role === 'ADMIN'
  const canManage = await canManageInventory(session.user.id, session.user.role)
  if (!isAdmin && !canManage && session.user.role !== 'TECHNICIAN') {
    return NextResponse.json({ error: 'No tienes permiso para solicitar bajas' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const assetType = formData.get('assetType') as string
    const equipmentId = formData.get('equipmentId') as string | null
    const licenseId = formData.get('licenseId') as string | null
    const reason = formData.get('reason') as string
    const condition = formData.get('condition') as string | null

    // Validaciones básicas
    if (!assetType || !['EQUIPMENT', 'LICENSE'].includes(assetType)) {
      return NextResponse.json({ error: 'Tipo de activo inválido' }, { status: 400 })
    }
    if (!reason || reason.trim().length < 10) {
      return NextResponse.json({ error: 'El motivo debe tener al menos 10 caracteres' }, { status: 400 })
    }
    if (assetType === 'EQUIPMENT' && !equipmentId) {
      return NextResponse.json({ error: 'Se requiere el ID del equipo' }, { status: 400 })
    }
    if (assetType === 'LICENSE' && !licenseId) {
      return NextResponse.json({ error: 'Se requiere el ID de la licencia' }, { status: 400 })
    }
    if (assetType === 'EQUIPMENT' && !condition) {
      return NextResponse.json({ error: 'La condición del equipo es requerida' }, { status: 400 })
    }

    // Validar equipo: no debe tener asignación activa
    if (assetType === 'EQUIPMENT' && equipmentId) {
      const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { status: true, code: true } })
      if (!equipment) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

      const activeAssignment = await prisma.equipment_assignments.findFirst({
        where: { equipmentId, isActive: true },
      })
      if (activeAssignment) {
        return NextResponse.json({
          error: 'No se puede solicitar la baja de un equipo que está asignado. Primero debe registrar su devolución',
        }, { status: 422 })
      }
    }

    // Validar no hay PENDING existente
    const existingPending = await prisma.decommission_requests.findFirst({
      where: {
        status: 'PENDING',
        ...(assetType === 'EQUIPMENT' ? { equipmentId } : { licenseId }),
      },
    })
    if (existingPending) {
      return NextResponse.json({ error: 'Ya existe una solicitud de baja pendiente para este activo' }, { status: 409 })
    }

    // Validar al menos 1 imagen para equipos
    const files = formData.getAll('images') as File[]
    if (assetType === 'EQUIPMENT' && files.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos una imagen como evidencia' }, { status: 400 })
    }

    // Advertencia: licencia con contractEndDate vigente
    let warning: string | undefined
    if (assetType === 'LICENSE' && licenseId) {
      const lic = await (prisma.software_licenses as any).findUnique({
        where: { id: licenseId },
        select: { contractEndDate: true, name: true },
      })
      if (lic?.contractEndDate && new Date(lic.contractEndDate) > new Date()) {
        const endDate = new Date(lic.contractEndDate).toLocaleDateString('es-ES')
        warning = `La licencia "${lic.name}" tiene un contrato vigente hasta el ${endDate}. Se recomienda esperar al vencimiento antes de solicitar la baja.`
      }
    }

    // Leer configuración de familia para autoApproveDecommission (solo para equipos)
    let autoApproveDecommission = false
    let familyId: string | null = null
    if (assetType === 'EQUIPMENT' && equipmentId) {
      const equipmentWithFamily = await prisma.equipment.findUnique({
        where: { id: equipmentId },
        select: { type: { select: { familyId: true } } },
      })
      familyId = equipmentWithFamily?.type?.familyId ?? null
      if (familyId) {
        const familyConfig = await prisma.inventory_family_config.findUnique({
          where: { familyId },
          select: { autoApproveDecommission: true },
        })
        autoApproveDecommission = familyConfig?.autoApproveDecommission ?? false
      }
    }

    // Crear solicitud
    const requestId = randomUUID()

    if (autoApproveDecommission && assetType === 'EQUIPMENT' && equipmentId) {
      // Auto-aprobación: crear request APPROVED + decommission_act + cambiar status a RETIRED en una transacción
      const folio = await FolioService.generateDecommissionActFolio()
      const actId = randomUUID()

      await prisma.$transaction(async (tx) => {
        await tx.decommission_requests.create({
          data: {
            id: requestId,
            assetType: assetType as any,
            equipmentId,
            licenseId: null,
            requestedById: session.user.id,
            reason: reason.trim(),
            condition: condition as any || null,
            status: 'APPROVED',
            reviewedById: session.user.id,
            reviewedAt: new Date(),
          },
        })

        await tx.decommission_acts.create({
          data: {
            id: actId,
            folio,
            requestId,
            approvedById: session.user.id,
            approvedAt: new Date(),
          },
        })

        await tx.equipment.update({
          where: { id: equipmentId },
          data: { status: 'RETIRED' },
        })
      })

      // Audit log con autoApproved y reason
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'DECOMMISSION',
          entityType: 'asset',
          entityId: equipmentId,
          userId: session.user.id,
          details: {
            autoApproved: true,
            reason: reason.trim(),
            familyId,
            folio,
          },
          createdAt: new Date(),
        },
      }).catch(() => {})
    } else {
      // Flujo normal: crear request con status = PENDING
      await prisma.decommission_requests.create({
        data: {
          id: requestId,
          assetType: assetType as any,
          equipmentId: equipmentId || null,
          licenseId: licenseId || null,
          requestedById: session.user.id,
          reason: reason.trim(),
          condition: condition as any || null,
          status: 'PENDING',
        },
      })

      // Audit log para solicitud pendiente
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'DECOMMISSION',
          entityType: 'asset',
          entityId: equipmentId ?? licenseId ?? requestId,
          userId: session.user.id,
          details: {
            autoApproved: false,
            reason: reason.trim(),
            familyId,
            requestId,
          },
          createdAt: new Date(),
        },
      }).catch(() => {})
    }

    // Guardar imágenes adjuntas
    if (files.length > 0) {
      const uploadDir = getUploadDir('decommission', requestId)
      if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filename = `${randomUUID()}.${ext}`
        const filepath = getUploadDir('decommission', requestId, filename)
        await writeFile(filepath, Buffer.from(await file.arrayBuffer()))

        await prisma.decommission_attachments.create({
          data: {
            id: randomUUID(),
            requestId,
            filename,
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
            path: filepath,
            uploadedBy: session.user.id,
          },
        })
      }
    }

    // Obtener nombre del activo para la notificación
    let assetName = 'Activo desconocido'
    if (assetType === 'EQUIPMENT' && equipmentId) {
      const eq = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { code: true, brand: true, model: true } })
      if (eq) assetName = `${eq.code} - ${eq.brand} ${eq.model}`
    } else if (assetType === 'LICENSE' && licenseId) {
      const lic = await prisma.software_licenses.findUnique({ where: { id: licenseId }, select: { name: true } })
      if (lic) assetName = lic.name
    }

    const requesterName = session.user.name || session.user.email || 'Usuario'

    // Notificar a todos los ADMIN (solo si es PENDING — si fue auto-aprobado, no requiere revisión)
    if (!autoApproveDecommission) {
      const admins = await prisma.users.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
      for (const admin of admins) {
        await prisma.notifications.create({
          data: {
            id: randomUUID(),
            userId: admin.id,
            type: 'WARNING',
            title: 'Nueva Solicitud de Baja',
            message: `${requesterName} solicitó la baja de "${assetName}". Motivo: ${reason.trim().substring(0, 100)}`,
            metadata: { link: `/inventory/decommission/${requestId}` },
            isRead: false,
          },
        }).catch(() => {})
      }
    }

    // Audit log de creación (legacy — mantenido para compatibilidad)
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'DECOMMISSION_REQUEST_CREATED',
        entityType: 'inventory',
        entityId: requestId,
        userId: session.user.id,
        details: { descripcion: `${requesterName} creó solicitud de baja para "${assetName}". Motivo: ${reason.trim().substring(0, 200)}` },
        createdAt: new Date(),
      },
    }).catch(() => {})

    const result = await prisma.decommission_requests.findUnique({
      where: { id: requestId },
      include: decommissionInclude,
    })

    return NextResponse.json({ ...result, warning }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear solicitud de baja' }, { status: 500 })
  }
}
