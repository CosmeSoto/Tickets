import { AssetRequestStatus, AssetType, Prisma, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAccessibleFamilyIds } from '@/lib/inventory/family-access'
import { createModuleCache } from '@/lib/api-cache'

// ── Response types ────────────────────────────────────────────────────────────

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
}

export interface AssetRequestListResponse {
  data: AssetRequestRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Actor roles used internally by the transition validation logic.
 *
 * - SUPER_ADMIN:       ADMIN with isSuperAdmin=true
 * - FAMILY_ADMIN:      ADMIN with isSuperAdmin=false
 * - REQUESTER_CANCEL:  The requester cancelling their own PENDING request
 * - CLIENT:            User with role CLIENT (read-only on transitions)
 * - TECHNICIAN:        User with role TECHNICIAN (read-only on transitions)
 */
export type AssetRequestActorRole =
  | 'SUPER_ADMIN'
  | 'FAMILY_ADMIN'
  | 'REQUESTER_CANCEL'
  | 'CLIENT'
  | 'TECHNICIAN'

/**
 * Result returned by validateTransition.
 *
 * - `valid: true`  — the transition is allowed for the given actor
 * - `valid: false` — the transition is blocked; `error` contains the error code
 *   that the API layer should map to the appropriate HTTP status:
 *     - 'TERMINAL_STATE'         → 409  (source state is terminal)
 *     - 'INVALID_TRANSITION'     → 409  (target state unreachable from source)
 *     - 'UNAUTHORIZED_TRANSITION'→ 403  (actor role not allowed for this edge)
 */
export interface TransitionResult {
  valid: boolean
  error?: 'TERMINAL_STATE' | 'INVALID_TRANSITION' | 'UNAUTHORIZED_TRANSITION'
}

/**
 * Matriz de transiciones válidas del módulo de Solicitud de Activos.
 *
 * Estructura: VALID_TRANSITIONS[currentStatus][newStatus] = allowedActors[]
 *
 * Los estados REJECTED y FULFILLED son terminales — no tienen transiciones
 * salientes, por lo que sus entradas son objetos vacíos.
 */
const VALID_TRANSITIONS: Record<
  AssetRequestStatus,
  Partial<Record<AssetRequestStatus, AssetRequestActorRole[]>>
> = {
  PENDING: {
    UNDER_REVIEW: ['FAMILY_ADMIN'],
    REJECTED: ['SUPER_ADMIN', 'REQUESTER_CANCEL'],
  },
  UNDER_REVIEW: {
    APPROVED: ['SUPER_ADMIN'],
    REJECTED: ['SUPER_ADMIN'],
  },
  APPROVED: {
    FULFILLED: ['SUPER_ADMIN', 'FAMILY_ADMIN'],
  },
  REJECTED: {}, // Terminal — no outgoing transitions
  FULFILLED: {}, // Terminal — no outgoing transitions
}

/**
 * Servicio principal para el módulo de Solicitud de Activos.
 *
 * Implementa el acceso a datos con scope por rol:
 * - CLIENT / TECHNICIAN: solo sus propias solicitudes
 * - Family Admin (ADMIN, isSuperAdmin=false): solicitudes de sus familias asignadas
 * - Super Admin (ADMIN, isSuperAdmin=true): todas las solicitudes sin restricción
 */
export class AssetRequestService {
  /**
   * Construye el filtro de scope de Prisma según el rol del usuario.
   *
   * - Super Admin: `{}` (sin restricción — ve todas las solicitudes)
   * - Family Admin (ADMIN, isSuperAdmin=false): `{ familyId: { in: assignedFamilyIds } }`
   * - CLIENT / TECHNICIAN: `{ requesterId: userId }`
   *
   * @param userId           ID del usuario autenticado
   * @param userRole         Rol del usuario (UserRole de Prisma)
   * @param isSuperAdmin     true si el usuario es Super Admin
   * @param assignedFamilyIds IDs de familias asignadas al Family Admin
   * @returns Filtro Prisma.asset_requestsWhereInput listo para usar en queries
   */
  private static buildScopeFilter(
    userId: string,
    userRole: UserRole,
    isSuperAdmin: boolean,
    assignedFamilyIds: string[]
  ): Prisma.asset_requestsWhereInput {
    // Super Admin: acceso global sin restricción
    if (isSuperAdmin) {
      return {}
    }

    // Family Admin (ADMIN normal): solo solicitudes de sus familias asignadas
    if (userRole === 'ADMIN') {
      return {
        familyId: { in: assignedFamilyIds },
      }
    }

    // CLIENT o TECHNICIAN: solo sus propias solicitudes
    return {
      requesterId: userId,
    }
  }

  /**
   * Valida si una transición de estado es permitida para el actor dado.
   *
   * Orden de evaluación:
   * 1. Si el estado actual es terminal (REJECTED / FULFILLED) → TERMINAL_STATE
   * 2. Si el estado destino no existe como arista desde el estado actual → INVALID_TRANSITION
   * 3. Si el actor no está en la lista de roles permitidos para esa arista → UNAUTHORIZED_TRANSITION
   * 4. En cualquier otro caso → válido
   *
   * @param currentStatus  Estado actual de la solicitud
   * @param newStatus      Estado al que se quiere transicionar
   * @param actorRole      Rol del actor que intenta la transición
   * @returns              { valid: true } o { valid: false, error: ErrorCode }
   */
  private static validateTransition(
    currentStatus: AssetRequestStatus,
    newStatus: AssetRequestStatus,
    actorRole: AssetRequestActorRole
  ): TransitionResult {
    const outgoing = VALID_TRANSITIONS[currentStatus]

    // 1. Terminal state — no outgoing edges at all
    if (Object.keys(outgoing).length === 0) {
      return { valid: false, error: 'TERMINAL_STATE' }
    }

    // 2. The target status is not reachable from the current status
    const allowedActors = outgoing[newStatus]
    if (!allowedActors) {
      return { valid: false, error: 'INVALID_TRANSITION' }
    }

    // 3. The actor role is not in the allowed list for this edge
    if (!allowedActors.includes(actorRole)) {
      return { valid: false, error: 'UNAUTHORIZED_TRANSITION' }
    }

    return { valid: true }
  }

  /**
   * Lista solicitudes de activos con filtros, paginación y caché Redis (TTL 30s).
   *
   * El scope de datos se aplica automáticamente según el rol del usuario:
   * - CLIENT / TECHNICIAN: solo sus propias solicitudes (`requesterId = userId`)
   * - Family Admin (ADMIN, isSuperAdmin=false): solicitudes de sus familias asignadas
   * - Super Admin (ADMIN, isSuperAdmin=true): todas las solicitudes sin restricción
   *
   * Filtros adicionales opcionales: `status`, `assetType`, `familyId`, `dateFrom`,
   * `dateTo` y `search` (búsqueda en código y descripción).
   *
   * @param filters      Filtros de búsqueda y paginación
   * @param userId       ID del usuario autenticado
   * @param userRole     Rol del usuario (UserRole de Prisma)
   * @param isSuperAdmin true si el usuario es Super Admin
   * @returns            Página de resultados con metadatos de paginación
   */
  static async listRequests(
    filters: AssetRequestFilters,
    userId: string,
    userRole: UserRole,
    isSuperAdmin: boolean
  ): Promise<AssetRequestListResponse> {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20))
    const skip = (page - 1) * limit

    // ── 1. Resolve accessible family IDs for scope filter ──────────────────
    // getAccessibleFamilyIds returns:
    //   undefined  → no restriction (Super Admin or Admin with no assignments)
    //   string[]   → only those families
    const accessibleFamilyIds = await getAccessibleFamilyIds(
      userId,
      userRole,
      isSuperAdmin,
      false // canManageInventory — not relevant for asset requests scope
    )

    // ── 2. Build scope WHERE clause ────────────────────────────────────────
    const scopeFilter = AssetRequestService.buildScopeFilter(
      userId,
      userRole,
      isSuperAdmin,
      accessibleFamilyIds ?? []
    )

    // ── 3. Build additional filter clauses ─────────────────────────────────
    const additionalFilters: Prisma.asset_requestsWhereInput[] = []

    // Status filter — accepts single value or array
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
      additionalFilters.push({ status: { in: statuses } })
    }

    // Asset type filter — accepts single value or array
    if (filters.assetType) {
      const types = Array.isArray(filters.assetType) ? filters.assetType : [filters.assetType]
      additionalFilters.push({ assetType: { in: types } })
    }

    // Family filter — intersect with scope (scope already restricts families for Family Admin)
    if (filters.familyId) {
      additionalFilters.push({ familyId: filters.familyId })
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      additionalFilters.push({
        createdAt: {
          ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
          ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
        },
      })
    }

    // Full-text search across code and description
    if (filters.search?.trim()) {
      const term = filters.search.trim()
      additionalFilters.push({
        OR: [
          { code: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      })
    }

    // Combine scope + additional filters
    const where: Prisma.asset_requestsWhereInput =
      additionalFilters.length > 0 ? { AND: [scopeFilter, ...additionalFilters] } : scopeFilter

    // ── 4. Cache key params — include userId and role for per-user isolation ─
    const cacheParams: Record<string, unknown> = {
      userId,
      role: userRole,
      isSuperAdmin,
      page,
      limit,
      ...(filters.status && {
        status: Array.isArray(filters.status) ? filters.status.join(',') : filters.status,
      }),
      ...(filters.assetType && {
        assetType: Array.isArray(filters.assetType)
          ? filters.assetType.join(',')
          : filters.assetType,
      }),
      ...(filters.familyId && { familyId: filters.familyId }),
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
      ...(filters.search?.trim() && { search: filters.search.trim() }),
    }

    // ── 5. Execute query with Redis cache (TTL 30s) ────────────────────────
    const moduleCache = createModuleCache('asset-requests', 30)

    return moduleCache.getList(cacheParams, async () => {
      const [records, total] = await prisma.$transaction([
        prisma.asset_requests.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
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
            family: {
              select: { name: true },
            },
            requester: {
              select: { name: true },
            },
          },
        }),
        prisma.asset_requests.count({ where }),
      ])

      const data: AssetRequestRow[] = records.map(r => ({
        id: r.id,
        code: r.code,
        assetType: r.assetType,
        // Truncate description to 100 chars for list view (full text in detail)
        description: r.description.length > 100 ? r.description.slice(0, 100) + '…' : r.description,
        familyId: r.familyId,
        familyName: r.family?.name ?? '',
        status: r.status,
        requesterId: r.requesterId,
        requesterName: r.requester?.name ?? '',
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    })
  }
}
