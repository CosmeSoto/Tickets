import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LicenseService } from '@/lib/services/license.service'

/**
 * GET /api/inventory/licenses/summary
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const summary = await LicenseService.getLicenseSummary()
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error en GET /api/inventory/licenses/summary:', error)
    return NextResponse.json({ error: 'Error al obtener resumen' }, { status: 500 })
  }
}
