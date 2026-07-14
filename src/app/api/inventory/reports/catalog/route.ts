import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getVisibleDatasets,
  getVisibleTemplates,
  REPORT_CATEGORIES,
  resolveUserReportRole,
} from '@/lib/inventory/reports/catalog'
import { resolveCanManageInventory } from '@/lib/inventory/inventory-session'

/**
 * GET /api/inventory/reports/catalog
 * Catálogo unificado: categorías, plantillas predefinidas y datasets explorables.
 */
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
  const canManage = await resolveCanManageInventory(session.user.id, session.user.role)
  const userRole = resolveUserReportRole(session.user.role, isSuperAdmin, canManage)

  const templates = getVisibleTemplates(userRole)
  const datasets = getVisibleDatasets(userRole)

  const categories = REPORT_CATEGORIES.map(category => ({
    ...category,
    templates: templates.filter(t => t.categoryId === category.id),
    datasets: datasets.filter(d => d.categoryId === category.id),
  })).filter(c => c.templates.length > 0 || c.datasets.length > 0)

  return NextResponse.json({
    userRole,
    categories,
    templates,
    datasets,
    stats: {
      templateCount: templates.length,
      datasetCount: datasets.length,
      categoryCount: categories.length,
    },
  })
}
