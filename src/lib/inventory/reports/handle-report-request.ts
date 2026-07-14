import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  canAccessTemplate,
  getTemplateBySlug,
  resolveUserReportRole,
} from '@/lib/inventory/reports/catalog'
import { respondWithReportFormat } from '@/lib/inventory/reports/respond-report'
import { resolveReportScope } from '@/lib/inventory/reports/scope'
import { runInventoryReportTemplate } from '@/lib/inventory/reports/template-runner'
import { resolveCanManageInventory } from '@/lib/inventory/inventory-session'
import {
  assertInventoryResourceRead,
  InventoryAccessError,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

function parseReportParams(searchParams: URLSearchParams): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of searchParams.entries()) {
    if (key !== 'format') params[key] = value
  }
  return params
}

/**
 * Handler unificado para GET /api/inventory/reports/{slug}
 * y para ?template= en /api/inventory/reports/run.
 */
export async function handleInventoryReportRequest(
  slug: string,
  request: NextRequest
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const template = getTemplateBySlug(slug)
    if (!template) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    }

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const canManage = await resolveCanManageInventory(session.user.id, session.user.role)
    const userRole = resolveUserReportRole(session.user.role, isSuperAdmin, canManage)

    if (!canAccessTemplate(slug, userRole)) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver este reporte' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format')
    const params = parseReportParams(searchParams)

    const scope =
      slug === 'financial-summary'
        ? { familyIds: undefined, noAccess: false }
        : await resolveReportScope(session.user, params.familyId || undefined)

    if (slug === 'by-model' && params.modelId) {
      await assertInventoryResourceRead(
        toInventoryAccessUser(session.user),
        'MODEL',
        params.modelId
      )
    }
    if (slug === 'by-batch' && params.batchId) {
      await assertInventoryResourceRead(
        toInventoryAccessUser(session.user),
        'BATCH',
        params.batchId
      )
    }

    const result = await runInventoryReportTemplate(slug, params, scope, {
      role: session.user.role,
      isSuperAdmin,
    })

    return respondWithReportFormat(slug, result, format)
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error(`Error en GET /api/inventory/reports/${slug}:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar reporte' },
      { status: 500 }
    )
  }
}
