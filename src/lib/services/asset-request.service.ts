/**
 * AssetRequestService — Servicio para gestión de solicitudes de activos
 *
 * Maneja el ciclo de vida completo de las solicitudes:
 * - Creación con código AR-{YEAR}-{SEQUENCE}
 * - Revisión por Family Admin (UNDER_REVIEW + comentarios)
 * - Aprobación/rechazo por Super Admin (con comentario obligatorio)
 * - Entrega (FULFILLED)
 * - Cancelación por requester (solo desde PENDING)
 *
 * Integración con:
 * - FolioService para códigos AR
 * - AuditServiceComplete para trazabilidad
 * - NotificationService para notificaciones
 * - Redis cache (TTL 30s) para listados
 * - system_settings para configuración por familia
 */

import prisma from '@/lib/prisma'
import { AssetRequestStatus, AssetType, UserRole } from '@prisma/client'
import { FolioService } from './folio.service'
import { AuditServiceComplete } from './audit-service-complete'
import { NotificationService } from './notification-service'
import { getFamilyScopedAdmins, getNativeFamilyAdmins } from '@/lib/notifications/family-recipients'
import { EmailService } from '@/lib/services/email/email-service'
import { createModuleCache, getSetting } from '@/lib/api-cache'
import {
  getAccessibleFamilyIds,
  checkInventoryRequestFamilyAccess,
} from '@/lib/inventory/family-access'
import { validateReviewerComment } from '@/lib/validations/inventory/asset-request'
import { SLAService } from './sla-service'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AssetRequestFilters {
  status?: AssetRequestStatus | AssetRequestStatus[]
  assetType?: AssetType | AssetType[]
  familyId?: string
  dateFrom?: string // ISO 8601
  dateTo?: string // ISO 8601
  search?: string // Búsqueda en código y descripción
  page?: number // default: 1
  limit?: number // default: 20
}

export interface AssetRequestListResponse {
  data: AssetRequestRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AssetRequestRow {
  id: string
  code: string
  assetType: AssetType
  description: string
  familyId: string
  familyName: string
  status: AssetRequestStatus
  requesterId: string
  requesterName: string
  createdAt: string
  updatedAt: string
  slaDeadline?: string | null
}

export interface AssetRequestDetail {
  id: string
  code: string
  assetType: AssetType
  description: string
  justification: string
  familyId: string
  familyName: string
  status: AssetRequestStatus
  requesterId: string
  requesterName: string
  assetId?: string | null
  assetName?: string | null
  quantity: number
  neededBy?: string | null
  reviewerComment?: string | null
  reviewedById?: string | null
  reviewedByName?: string | null
  reviewedAt?: string | null
  fulfilledById?: string | null
  fulfilledByName?: string | null
  fulfilledAt?: string | null
  reviewComments: ReviewComment[]
  createdAt: string
  updatedAt: string
  slaDeadline?: string | null
  slaMetrics?: {
    responseDeadline?: string | null
    resolutionDeadline?: string | null
    firstResponseAt?: string | null
    fulfilledAt?: string | null
    responseSLAMet?: boolean | null
    resolutionSLAMet?: boolean | null
  } | null
}

export interface ReviewComment {
  id: string
  userId: string
  userName: string
  userRole: string
  comment: string
  createdAt: string
}

export interface CreateAssetRequestInput {
  assetType: AssetType
  description: string
  familyId: string
  justification: string
  assetId?: string
  quantity?: number
  neededBy?: string
}

export interface TransitionValidation {
  valid: boolean
  error?: string
}

// ── Matriz de transiciones válidas ───────────────────────────────────────────

const VALID_TRANSITIONS: Record<
  AssetRequestStatus,
  Partial<Record<AssetRequestStatus, string[]>>
> = {
  PENDING: {
    UNDER_REVIEW: ['FAMILY_ADMIN', 'SUPER_ADMIN'],
    REJECTED: ['SUPER_ADMIN', 'REQUESTER_CANCEL'],
  },
  UNDER_REVIEW: {
    APPROVED: ['SUPER_ADMIN'],
    REJECTED: ['SUPER_ADMIN'],
  },
  APPROVED: {
    FULFILLED: ['SUPER_ADMIN', 'FAMILY_ADMIN'],
  },
  REJECTED: {}, // Terminal
  FULFILLED: {}, // Terminal
}

// ── Cache helper ──────────────────────────────────────────────────────────────

const cache = createModuleCache('asset-requests', 30) // TTL 30s

// ── Servicio principal ────────────────────────────────────────────────────────

export class AssetRequestService {
  /**
   * Construye el filtro de scope según el rol del usuario.
   *
   * - CLIENT/TECHNICIAN: solo sus propias solicitudes
   * - Family Admin: solicitudes de sus familias asignadas
   * - Super Admin: sin restricción
   */
  private static buildScopeFilter(
    userId: string,
    userRole: UserRole,
    isSuperAdmin: boolean,
    assignedFamilyIds: string[] | undefined
  ): any {
    // Super Admin: sin restricción
    if (userRole === 'ADMIN' && isSuperAdmin) {
      return {}
    }

    // Family Admin: solo sus familias asignadas
    if (userRole === 'ADMIN' && assignedFamilyIds !== undefined) {
      return { familyId: { in: assignedFamilyIds } }
    }

    // CLIENT/TECHNICIAN: solo sus propias solicitudes
    return { requesterId: userId }
  }

  /**
   * Valida si una transición de estado es válida según el rol del actor.
   *
   * Retorna { valid: true } si la transición es permitida.
   * Retorna { valid: false, error: string } si no es permitida.
   */
  private static validateTransition(
    currentStatus: AssetRequestStatus,
    newStatus: AssetRequestStatus,
    actorRole: UserRole,
    isSuperAdmin: boolean,
    isRequesterCancel: boolean = false
  ): TransitionValidation {
    // Estados terminales no pueden cambiar
    if (currentStatus === 'REJECTED' || currentStatus === 'FULFILLED') {
      return {
        valid: false,
        error: 'La solicitud está en un estado terminal y no puede modificarse',
      }
    }

    // Obtener transiciones válidas desde el estado actual
    const validTransitions = VALID_TRANSITIONS[currentStatus]
    if (!validTransitions || !validTransitions[newStatus]) {
      return {
        valid: false,
        error: `No se puede cambiar de ${currentStatus} a ${newStatus}`,
      }
    }

    const allowedRoles = validTransitions[newStatus]!

    // Verificar autorización según el rol
    if (isRequesterCancel && allowedRoles.includes('REQUESTER_CANCEL')) {
      return { valid: true }
    }

    if (isSuperAdmin && allowedRoles.includes('SUPER_ADMIN')) {
      return { valid: true }
    }

    if (actorRole === 'ADMIN' && !isSuperAdmin && allowedRoles.includes('FAMILY_ADMIN')) {
      return { valid: true }
    }

    return {
      valid: false,
      error: 'No tienes permiso para realizar esta transición de estado',
    }
  }

  /**
   * Lista solicitudes con filtros, paginación y scope por rol.
   * Aplica caché Redis con TTL 30s.
   */
  static async listRequests(
    filters: AssetRequestFilters,
    userId: string,
    userRole: UserRole,
    isSuperAdmin: boolean
  ): Promise<AssetRequestListResponse> {
    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    // Obtener familias accesibles
    const assignedFamilyIds = await getAccessibleFamilyIds(
      userId,
      userRole,
      isSuperAdmin,
      false // canManageInventory no aplica aquí
    )

    // Construir filtro de scope
    const scopeFilter = this.buildScopeFilter(userId, userRole, isSuperAdmin, assignedFamilyIds)

    // Construir WHERE completo
    const where: any = { ...scopeFilter }

    // Filtros adicionales
    if (filters.status) {
      where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status
    }

    if (filters.assetType) {
      where.assetType = Array.isArray(filters.assetType)
        ? { in: filters.assetType }
        : filters.assetType
    }

    if (filters.familyId) {
      where.familyId = filters.familyId
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo)
    }

    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    // Usar caché con clave que incluye userId, role y filtros
    const cacheKey = `list:${userId}:${userRole}:${JSON.stringify(filters)}`

    return cache.getList({ key: cacheKey }, async () => {
      const [data, total] = await Promise.all([
        prisma.asset_requests.findMany({
          where,
          select: {
            id: true,
            code: true,
            assetType: true,
            description: true,
            familyId: true,
            status: true,
            requesterId: true,
            createdAt: true,
            updatedAt: true,
            slaDeadline: true,
            family: {
              select: { name: true },
            },
            requester: {
              select: { name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.asset_requests.count({ where }),
      ])

      const rows: AssetRequestRow[] = data.map(r => ({
        id: r.id,
        code: r.code,
        assetType: r.assetType,
        description: r.description.substring(0, 100),
        familyId: r.familyId,
        familyName: r.family.name,
        status: r.status,
        requesterId: r.requesterId,
        requesterName: r.requester.name,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        slaDeadline: r.slaDeadline?.toISOString() || null,
      }))

      return {
        data: rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    })
  }

  /**
   * Crea una nueva solicitud de activo.
   *
   * - Verifica que el módulo esté habilitado para la familia
   * - Verifica acceso del usuario a la familia
   * - Genera código AR-{YEAR}-{SEQUENCE}
   * - Registra en audit_logs
   * - Envía notificaciones a Family Admins y Super Admin
   * - Invalida caché
   */
  static async createRequest(
    data: CreateAssetRequestInput,
    userId: string,
    userRole: UserRole,
    isSuperAdmin: boolean,
    ipAddress?: string
  ): Promise<AssetRequestDetail> {
    // 1. Verificar que el módulo está habilitado para la familia
    const enabled = await this.isAssetRequestsEnabledForFamily(data.familyId)
    if (!enabled) {
      throw new Error('ASSET_REQUESTS_DISABLED')
    }

    // 2. Verificar acceso del usuario a la familia (scope consumer)
    const canRequestInFamily = await checkInventoryRequestFamilyAccess(
      userId,
      data.familyId,
      userRole,
      isSuperAdmin
    )
    if (!canRequestInFamily) {
      throw new Error('FAMILY_ACCESS_DENIED')
    }

    // 3. Validar disponibilidad si quantity > 1 y assetType === EQUIPMENT
    const quantity = data.quantity || 1
    if (quantity > 1 && data.assetType === 'EQUIPMENT' && data.assetId) {
      const availableCount = await prisma.equipment.count({
        where: {
          typeId: data.assetId,
          status: 'AVAILABLE',
        },
      })

      if (availableCount < quantity) {
        throw new Error(
          `Solo hay ${availableCount} unidades disponibles de este tipo. Solicitaste ${quantity} unidades.`
        )
      }
    }

    // 4. Generar código AR
    const code = await FolioService.generateAssetRequestCode()

    // 5. Crear registro
    const request = await prisma.asset_requests.create({
      data: {
        code,
        assetType: data.assetType,
        description: data.description,
        justification: data.justification,
        familyId: data.familyId,
        requesterId: userId,
        assetId: data.assetId || null,
        quantity: quantity,
        neededBy: data.neededBy ? new Date(data.neededBy) : null,
        status: 'PENDING',
        reviewComments: [],
      },
      include: {
        family: { select: { name: true } },
        requester: { select: { name: true } },
      },
    })

    // 6. Registrar en audit_logs
    await AuditServiceComplete.log({
      action: 'asset_request_created',
      entityType: 'inventory',
      entityId: request.id,
      userId,
      ipAddress,
      details: {
        code: request.code,
        assetType: request.assetType,
        familyId: request.familyId,
        familyName: request.family.name,
        quantity: request.quantity,
      },
    })

    // 7. Enviar notificaciones a Family Admins y Super Admin
    await this.notifyRequestCreated(request.id, request.code, request.family.name)

    // 8. Asignar SLA
    await SLAService.assignSLAToAssetRequest(request.id)

    // 9. Invalidar caché
    await cache.invalidate()

    // 10. Retornar detalle
    const detail = await this.getRequestDetail(request.id, userId, userRole, isSuperAdmin)
    if (!detail) {
      throw new Error('REQUEST_NOT_FOUND')
    }
    return detail
  }

  /**
   * Familias con solicitud de activos habilitada y accesibles para el usuario.
   * Sin setting explícito: habilitada si el inventario está activo para la familia.
   */
  static async isAssetRequestsEnabledForFamily(familyId: string): Promise<boolean> {
    const explicit = await getSetting(`asset_requests_enabled_${familyId}`, 600, '')
    if (explicit === 'true') return true
    if (explicit === 'false') return false

    const cfg = await prisma.inventory_family_config.findUnique({
      where: { familyId },
      select: { inventoryEnabled: true },
    })
    return cfg?.inventoryEnabled !== false
  }

  static async getEnabledFamilies(
    userId: string,
    userRole: UserRole,
    isSuperAdmin: boolean,
    canManageInventory = false
  ): Promise<Array<{ id: string; name: string; color: string | null }>> {
    const accessibleIds = await getAccessibleFamilyIds(
      userId,
      userRole,
      isSuperAdmin,
      canManageInventory
    )

    const families = await prisma.families.findMany({
      where: {
        isActive: true,
        ...(accessibleIds !== undefined ? { id: { in: accessibleIds } } : {}),
      },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    })

    if (families.length === 0) return []

    const settings = await prisma.system_settings.findMany({
      where: {
        key: { in: families.map(f => `asset_requests_enabled_${f.id}`) },
      },
      select: { key: true, value: true },
    })
    const explicitEnabled = new Set(
      settings
        .filter(s => s.value === 'true')
        .map(s => s.key.replace('asset_requests_enabled_', ''))
    )
    const explicitDisabled = new Set(
      settings
        .filter(s => s.value === 'false')
        .map(s => s.key.replace('asset_requests_enabled_', ''))
    )

    const invConfigs = await prisma.inventory_family_config.findMany({
      where: { familyId: { in: families.map(f => f.id) } },
      select: { familyId: true, inventoryEnabled: true },
    })
    const inventoryEnabledIds = new Set(
      invConfigs.filter(c => c.inventoryEnabled !== false).map(c => c.familyId)
    )

    return families.filter(f => {
      if (explicitDisabled.has(f.id)) return false
      if (explicitEnabled.has(f.id)) return true
      return inventoryEnabledIds.has(f.id)
    })
  }

  private static async resolveAssetName(
    assetType: AssetType,
    assetId: string | null
  ): Promise<string | null> {
    if (!assetId) return null

    if (assetType === 'EQUIPMENT') {
      const equipmentType = await prisma.equipment_types.findUnique({
        where: { id: assetId },
        select: { name: true },
      })
      return equipmentType?.name ?? null
    }

    if (assetType === 'LICENSE') {
      const licenseType = await prisma.license_types.findUnique({
        where: { id: assetId },
        select: { name: true },
      })
      return licenseType?.name ?? null
    }

    return null
  }

  /**
   * Obtiene el detalle completo de una solicitud.
   *
   * Verifica acceso del usuario a la familia de la solicitud.
   * Retorna null si no tiene acceso (para que el endpoint retorne 404).
   */
  static async getRequestDetail(
    requestId: string,
    userId: string,
    userRole: UserRole,
    isSuperAdmin: boolean
  ): Promise<AssetRequestDetail | null> {
    const request = await prisma.asset_requests.findUnique({
      where: { id: requestId },
      include: {
        family: { select: { name: true } },
        requester: { select: { name: true } },
        reviewedBy: { select: { name: true } },
        fulfilledBy: { select: { name: true } },
        asset_request_sla_metrics: true,
      },
    })

    if (!request) return null

    // Verificar acceso según rol
    const accessibleFamilyIds = await getAccessibleFamilyIds(userId, userRole, isSuperAdmin, false)

    // Super Admin: acceso total
    if (userRole === 'ADMIN' && isSuperAdmin) {
      // OK
    }
    // Family Admin: solo sus familias
    else if (userRole === 'ADMIN' && accessibleFamilyIds !== undefined) {
      if (!accessibleFamilyIds.includes(request.familyId)) {
        return null
      }
    }
    // CLIENT/TECHNICIAN: solo sus propias solicitudes
    else {
      if (request.requesterId !== userId) {
        return null
      }
    }

    // Parsear reviewComments (JSON array)
    const reviewComments = Array.isArray(request.reviewComments)
      ? (request.reviewComments as unknown as ReviewComment[])
      : []

    const assetName = await this.resolveAssetName(request.assetType, request.assetId)

    return {
      id: request.id,
      code: request.code,
      assetType: request.assetType,
      description: request.description,
      justification: request.justification,
      familyId: request.familyId,
      familyName: request.family.name,
      status: request.status,
      requesterId: request.requesterId,
      requesterName: request.requester.name,
      assetId: request.assetId,
      assetName,
      quantity: request.quantity,
      neededBy: request.neededBy?.toISOString() || null,
      reviewerComment: request.reviewerComment,
      reviewedById: request.reviewedById,
      reviewedByName: request.reviewedBy?.name || null,
      reviewedAt: request.reviewedAt?.toISOString() || null,
      fulfilledById: request.fulfilledById,
      fulfilledByName: request.fulfilledBy?.name || null,
      fulfilledAt: request.fulfilledAt?.toISOString() || null,
      reviewComments,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      slaDeadline: request.slaDeadline?.toISOString() || null,
      slaMetrics: request.asset_request_sla_metrics
        ? {
            responseDeadline:
              request.asset_request_sla_metrics.responseDeadline?.toISOString() || null,
            resolutionDeadline:
              request.asset_request_sla_metrics.resolutionDeadline?.toISOString() || null,
            firstResponseAt:
              request.asset_request_sla_metrics.firstResponseAt?.toISOString() || null,
            fulfilledAt: request.asset_request_sla_metrics.fulfilledAt?.toISOString() || null,
            responseSLAMet: request.asset_request_sla_metrics.responseSLAMet,
            resolutionSLAMet: request.asset_request_sla_metrics.resolutionSLAMet,
          }
        : null,
    }
  }

  /**
   * Cambia el estado de una solicitud.
   *
   * - Valida la transición con validateTransition
   * - Valida comentario obligatorio para APPROVED y REJECTED
   * - Actualiza el registro con los campos correspondientes
   * - Registra en audit_logs
   * - Envía notificaciones según el evento
   * - Invalida caché
   */
  static async updateStatus(
    requestId: string,
    newStatus: AssetRequestStatus,
    comment: string | undefined,
    userId: string,
    userRole: UserRole,
    isSuperAdmin: boolean,
    ipAddress?: string
  ): Promise<AssetRequestDetail> {
    // 1. Obtener solicitud actual
    const request = await prisma.asset_requests.findUnique({
      where: { id: requestId },
      include: {
        family: { select: { name: true } },
        requester: { select: { name: true, id: true } },
      },
    })

    if (!request) {
      throw new Error('REQUEST_NOT_FOUND')
    }

    // 2. Verificar acceso del usuario a la familia
    const accessibleFamilyIds = await getAccessibleFamilyIds(userId, userRole, isSuperAdmin, false)

    if (accessibleFamilyIds !== undefined && !accessibleFamilyIds.includes(request.familyId)) {
      throw new Error('FAMILY_ACCESS_DENIED')
    }

    // 3. Determinar si es cancelación por requester
    const isRequesterCancel =
      request.requesterId === userId && request.status === 'PENDING' && newStatus === 'REJECTED'

    // 4. Validar transición
    const validation = this.validateTransition(
      request.status,
      newStatus,
      userRole,
      isSuperAdmin,
      isRequesterCancel
    )

    if (!validation.valid) {
      throw new Error(validation.error || 'INVALID_TRANSITION')
    }

    // 5. Validar comentario obligatorio para APPROVED y REJECTED (Super Admin)
    if ((newStatus === 'APPROVED' || newStatus === 'REJECTED') && !isRequesterCancel) {
      if (!comment || !validateReviewerComment(comment)) {
        throw new Error('COMMENT_REQUIRED')
      }
    }

    // 6. Preparar datos de actualización
    const updateData: any = {
      status: newStatus,
      updatedAt: new Date(),
    }

    // Campos específicos según el nuevo estado
    if (newStatus === 'APPROVED' || newStatus === 'REJECTED') {
      updateData.reviewerComment = comment
      updateData.reviewedById = userId
      updateData.reviewedAt = new Date()
    }

    if (newStatus === 'FULFILLED') {
      updateData.fulfilledById = userId
      updateData.fulfilledAt = new Date()
    }

    // Cancelación por requester: comentario automático
    if (isRequesterCancel) {
      updateData.reviewerComment = 'Cancelada por el solicitante'
    }

    // 7. Actualizar registro
    await prisma.asset_requests.update({
      where: { id: requestId },
      data: updateData,
    })

    // 8. Registrar en audit_logs
    await AuditServiceComplete.log({
      action: 'asset_request_status_changed',
      entityType: 'inventory',
      entityId: requestId,
      userId,
      ipAddress,
      oldValues: { status: request.status },
      newValues: { status: newStatus },
      details: {
        code: request.code,
        familyId: request.familyId,
        familyName: request.family.name,
        comment: comment || updateData.reviewerComment,
      },
    })

    // 9. Enviar notificaciones según el evento
    await this.notifyStatusChange(
      requestId,
      request.code,
      request.status,
      newStatus,
      request.requester.id,
      request.requester.name,
      request.familyId,
      comment
    )

    // 10. Registrar SLA según el nuevo estado
    if (newStatus === 'UNDER_REVIEW') {
      // Primera respuesta (cuando pasa a UNDER_REVIEW)
      await SLAService.recordFirstResponseToAssetRequest(requestId)
    }
    if (newStatus === 'FULFILLED') {
      // Cumplimiento (cuando pasa a FULFILLED)
      await SLAService.recordFulfillment(requestId)
    }

    // 11. Invalidar caché
    await cache.invalidate(requestId)

    // 12. Retornar detalle actualizado
    const detail = await this.getRequestDetail(requestId, userId, userRole, isSuperAdmin)
    if (!detail) {
      throw new Error('REQUEST_NOT_FOUND')
    }
    return detail
  }

  /**
   * Aprueba una solicitud y asigna equipos específicos.
   *
   * - Valida que la cantidad de equipos seleccionados coincida con la cantidad solicitada
   * - Valida que todos los equipos estén disponibles
   * - Crea asignaciones para cada equipo
   * - Actualiza el estado de los equipos a ASSIGNED
   * - Envía notificación con los códigos de equipos asignados
   */
  static async approveWithEquipment(
    requestId: string,
    equipmentIds: string[],
    comment: string,
    userId: string,
    userRole: UserRole,
    isSuperAdmin: boolean,
    ipAddress?: string
  ): Promise<AssetRequestDetail> {
    // 1. Obtener solicitud actual
    const request = await prisma.asset_requests.findUnique({
      where: { id: requestId },
      include: {
        family: { select: { name: true } },
        requester: { select: { name: true, id: true, email: true } },
      },
    })

    if (!request) {
      throw new Error('REQUEST_NOT_FOUND')
    }

    // 2. Verificar acceso del usuario a la familia
    const accessibleFamilyIds = await getAccessibleFamilyIds(userId, userRole, isSuperAdmin, false)

    if (accessibleFamilyIds !== undefined && !accessibleFamilyIds.includes(request.familyId)) {
      throw new Error('FAMILY_ACCESS_DENIED')
    }

    // 3. Validar que el usuario tenga permisos para aprobar
    const validation = this.validateTransition(
      request.status,
      'APPROVED',
      userRole,
      isSuperAdmin,
      false
    )

    if (!validation.valid) {
      throw new Error(validation.error || 'INVALID_TRANSITION')
    }

    // 4. Validar que la cantidad de equipos seleccionados coincida con la cantidad solicitada
    if (equipmentIds.length !== request.quantity) {
      throw new Error(
        `Debes seleccionar exactamente ${request.quantity} equipos. Seleccionaste ${equipmentIds.length}.`
      )
    }

    // 5. Validar que todos los equipos existan y estén disponibles
    const equipment = await prisma.equipment.findMany({
      where: {
        id: { in: equipmentIds },
      },
      select: {
        id: true,
        code: true,
        status: true,
        typeId: true,
      },
    })

    if (equipment.length !== equipmentIds.length) {
      throw new Error('Uno o más equipos no existen')
    }

    // Verificar que todos estén disponibles
    const unavailableEquipment = equipment.filter(eq => eq.status !== 'AVAILABLE')
    if (unavailableEquipment.length > 0) {
      throw new Error(`El equipo ${unavailableEquipment[0].code} ya no está disponible`)
    }

    // Verificar que todos sean del tipo solicitado (si aplica)
    if (request.assetType === 'EQUIPMENT' && request.assetId) {
      const wrongTypeEquipment = equipment.filter(eq => eq.typeId !== request.assetId)
      if (wrongTypeEquipment.length > 0) {
        throw new Error(`El equipo ${wrongTypeEquipment[0].code} no es del tipo solicitado`)
      }
    }

    // 6. Iniciar transacción para actualizar solicitud, crear asignaciones y actualizar equipos
    const result = await prisma.$transaction(async tx => {
      // Actualizar solicitud a APPROVED
      await tx.asset_requests.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewerComment: comment,
          reviewedById: userId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      })

      // Crear asignaciones para cada equipo
      const assignments = await Promise.all(
        equipmentIds.map(equipmentId =>
          tx.equipment_assignments.create({
            data: {
              equipmentId,
              receiverId: request.requesterId,
              delivererId: userId,
              assignmentType: 'PERMANENT',
              startDate: new Date(),
              isActive: true,
              accessories: [],
              observations: `Asignado por solicitud ${request.code}`,
            },
            include: {
              equipment: {
                select: {
                  code: true,
                },
              },
            },
          })
        )
      )

      // Actualizar estado de equipos a ASSIGNED
      await tx.equipment.updateMany({
        where: {
          id: { in: equipmentIds },
        },
        data: {
          status: 'ASSIGNED',
          updatedAt: new Date(),
        },
      })

      return assignments
    })

    // 7. Registrar en audit_logs
    await AuditServiceComplete.log({
      action: 'asset_request_approved_with_equipment',
      entityType: 'inventory',
      entityId: requestId,
      userId,
      ipAddress,
      oldValues: { status: request.status },
      newValues: { status: 'APPROVED' },
      details: {
        code: request.code,
        familyId: request.familyId,
        familyName: request.family.name,
        comment,
        equipmentCodes: result.map(a => a.equipment.code),
        quantity: request.quantity,
      },
    })

    // 8. Enviar notificación con códigos de equipos asignados
    const equipmentCodes = result.map(a => a.equipment.code).join(', ')
    await this.notifyApprovalWithEquipment(
      requestId,
      request.code,
      request.requester.id,
      request.requester.name,
      request.requester.email,
      request.familyId,
      request.quantity,
      equipmentCodes,
      comment
    )

    // 9. Registrar SLA de cumplimiento
    await SLAService.recordFulfillment(requestId)

    // 10. Invalidar caché
    await cache.invalidate(requestId)

    // 11. Retornar detalle actualizado
    const detail = await this.getRequestDetail(requestId, userId, userRole, isSuperAdmin)
    if (!detail) {
      throw new Error('REQUEST_NOT_FOUND')
    }
    return detail
  }

  /**
   * Agrega un comentario interno a una solicitud.
   *
   * - Verifica acceso del usuario a la familia
   * - Verifica que el estado permite comentarios
   * - Agrega el comentario al array JSON reviewComments
   * - Registra en audit_logs
   * - Envía notificación al Super Admin si el comentario lo agrega un Family Admin
   */
  static async addComment(
    requestId: string,
    comment: string,
    userId: string,
    userName: string,
    userRole: UserRole,
    isSuperAdmin: boolean
  ): Promise<ReviewComment> {
    // 1. Obtener solicitud
    const request = await prisma.asset_requests.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        code: true,
        status: true,
        familyId: true,
        reviewComments: true,
      },
    })

    if (!request) {
      throw new Error('REQUEST_NOT_FOUND')
    }

    // 2. Verificar acceso del usuario a la familia
    const accessibleFamilyIds = await getAccessibleFamilyIds(userId, userRole, isSuperAdmin, false)

    if (accessibleFamilyIds !== undefined && !accessibleFamilyIds.includes(request.familyId)) {
      throw new Error('FAMILY_ACCESS_DENIED')
    }

    // 3. Verificar que el estado permite comentarios
    const terminalStates: AssetRequestStatus[] = ['REJECTED', 'FULFILLED']
    if (terminalStates.includes(request.status)) {
      // Super Admin puede comentar en cualquier estado no terminal
      if (!isSuperAdmin) {
        throw new Error('CANNOT_COMMENT_ON_TERMINAL_STATE')
      }
    }

    // Family Admin solo puede comentar en PENDING o UNDER_REVIEW
    if (userRole === 'ADMIN' && !isSuperAdmin) {
      const allowedStates: AssetRequestStatus[] = ['PENDING', 'UNDER_REVIEW']
      if (!allowedStates.includes(request.status)) {
        throw new Error('CANNOT_COMMENT_IN_THIS_STATE')
      }
    }

    // 4. Crear nuevo comentario
    const newComment: ReviewComment = {
      id: crypto.randomUUID(),
      userId,
      userName,
      userRole,
      comment,
      createdAt: new Date().toISOString(),
    }

    // 5. Agregar al array JSON
    const currentComments = Array.isArray(request.reviewComments)
      ? (request.reviewComments as unknown as ReviewComment[])
      : []

    await prisma.asset_requests.update({
      where: { id: requestId },
      data: {
        reviewComments: [...currentComments, newComment] as any,
        updatedAt: new Date(),
      },
    })

    // 6. Registrar en audit_logs
    await AuditServiceComplete.log({
      action: 'asset_request_comment_added',
      entityType: 'inventory',
      entityId: requestId,
      userId,
      details: {
        code: request.code,
        comment,
        userName,
        userRole,
      },
    })

    // 7. Enviar notificación al Super Admin si el comentario lo agrega un Family Admin
    if (userRole === 'ADMIN' && !isSuperAdmin) {
      await this.notifyCommentAdded(requestId, request.code, userName)
    }

    return newComment
  }

  // ── Métodos de notificación ────────────────────────────────────────────────

  /**
   * Notifica la creación de una solicitud a Family Admins y Super Admin.
   */
  private static async notifyRequestCreated(
    requestId: string,
    code: string,
    familyName: string
  ): Promise<void> {
    try {
      // Obtener Super Admin
      const superAdmins = await prisma.users.findMany({
        where: { role: 'ADMIN', isSuperAdmin: true, isActive: true },
        select: { id: true },
      })

      // Obtener Family Admins de la familia
      const request = await prisma.asset_requests.findUnique({
        where: { id: requestId },
        select: { familyId: true },
      })

      if (!request) return

      const familyAdmins = await getNativeFamilyAdmins(request.familyId, { id: true })

      const recipients = [...superAdmins, ...familyAdmins]

      await Promise.all(
        recipients.map(recipient =>
          NotificationService.push({
            userId: recipient.id,
            type: 'INVENTORY',
            title: 'Nueva solicitud de activo',
            message: `Se ha creado la solicitud ${code} para la familia ${familyName}`,
            metadata: { requestId, code, familyName },
          })
        )
      )
    } catch (error) {
      console.error('[ASSET_REQUEST] Error notifying request created:', error)
    }
  }

  /**
   * Notifica cambios de estado según el evento.
   */
  private static async notifyStatusChange(
    requestId: string,
    code: string,
    oldStatus: AssetRequestStatus,
    newStatus: AssetRequestStatus,
    requesterId: string,
    requesterName: string,
    familyId: string,
    comment?: string
  ): Promise<void> {
    try {
      // UNDER_REVIEW: notificar a Super Admin
      if (newStatus === 'UNDER_REVIEW') {
        const superAdmins = await prisma.users.findMany({
          where: { role: 'ADMIN', isSuperAdmin: true, isActive: true },
          select: { id: true },
        })

        await Promise.all(
          superAdmins.map(admin =>
            NotificationService.push({
              userId: admin.id,
              type: 'INVENTORY',
              title: 'Solicitud en revisión',
              message: `La solicitud ${code} está en revisión`,
              metadata: { requestId, code },
            })
          )
        )
      }

      // APPROVED o REJECTED: notificar a requester y Family Admins
      if (newStatus === 'APPROVED' || newStatus === 'REJECTED') {
        const statusText = newStatus === 'APPROVED' ? 'aprobada' : 'rechazada'

        // Notificar al requester
        await NotificationService.push({
          userId: requesterId,
          type: newStatus === 'APPROVED' ? 'SUCCESS' : 'WARNING',
          title: `Solicitud ${statusText}`,
          message: `Tu solicitud ${code} ha sido ${statusText}. ${comment || ''}`,
          metadata: { requestId, code, comment },
        })

        // Notificar a Family Admins de la familia
        const familyAdmins = await getNativeFamilyAdmins(familyId, { id: true })

        await Promise.all(
          familyAdmins.map(admin =>
            NotificationService.push({
              userId: admin.id,
              type: 'INVENTORY',
              title: `Solicitud ${statusText}`,
              message: `La solicitud ${code} de ${requesterName} ha sido ${statusText}`,
              metadata: { requestId, code },
            })
          )
        )
      }

      // FULFILLED: notificar al requester
      if (newStatus === 'FULFILLED') {
        await NotificationService.push({
          userId: requesterId,
          type: 'SUCCESS',
          title: 'Solicitud entregada',
          message: `Tu solicitud ${code} ha sido entregada`,
          metadata: { requestId, code },
        })
      }
    } catch (error) {
      console.error('[ASSET_REQUEST] Error notifying status change:', error)
    }
  }

  /**
   * Notifica al Super Admin cuando un Family Admin agrega un comentario.
   */
  private static async notifyCommentAdded(
    requestId: string,
    code: string,
    userName: string
  ): Promise<void> {
    try {
      const superAdmins = await prisma.users.findMany({
        where: { role: 'ADMIN', isSuperAdmin: true, isActive: true },
        select: { id: true },
      })

      await Promise.all(
        superAdmins.map(admin =>
          NotificationService.push({
            userId: admin.id,
            type: 'INVENTORY',
            title: 'Nuevo comentario en solicitud',
            message: `${userName} ha agregado un comentario a la solicitud ${code}`,
            metadata: { requestId, code },
          })
        )
      )
    } catch (error) {
      console.error('[ASSET_REQUEST] Error notifying comment added:', error)
    }
  }

  /**
   * Notifica al solicitante sobre la aprobación con equipos asignados
   */
  private static async notifyApprovalWithEquipment(
    requestId: string,
    code: string,
    requesterId: string,
    requesterName: string,
    requesterEmail: string,
    familyId: string,
    quantity: number,
    equipmentCodes: string,
    comment?: string
  ): Promise<void> {
    try {
      // Notificación push al solicitante
      await NotificationService.push({
        userId: requesterId,
        type: 'INVENTORY',
        title: 'Solicitud aprobada',
        message: `Tu solicitud de ${quantity} unidades ha sido aprobada. Equipos asignados: ${equipmentCodes}`,
        metadata: { requestId, code },
      })

      // Email al solicitante
      await EmailService.queueEmail({
        to: requesterEmail,
        subject: `Solicitud ${code} aprobada`,
        text: `Hola ${requesterName},\n\nTu solicitud ${code} ha sido aprobada. Unidades: ${quantity}.\nEquipos asignados: ${equipmentCodes}${comment ? `\n\nComentario: ${comment}` : ''}`,
      })
    } catch (error) {
      console.error('[ASSET_REQUEST] Error notifying approval with equipment:', error)
    }
  }
}
