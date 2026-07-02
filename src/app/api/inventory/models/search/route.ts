/**
 * API Route: Search Equipment Models
 * GET /api/inventory/models/search - Search models by text
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchModels } from '@/lib/services/equipment-models.service'
import { canManageInventory } from '@/lib/inventory-access'

/**
 * GET /api/inventory/models/search?q=dell&limit=20
 * Search equipment models by text
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check inventory access
    const hasAccess = await canManageInventory(session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const familyId = searchParams.get('familyId') || undefined
    const typeId = searchParams.get('typeId') || undefined

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ models: [] })
    }

    let models = await searchModels(query, limit, familyId)
    if (typeId) {
      models = models.filter(m => m.typeId === typeId)
    }

    return NextResponse.json({ models })
  } catch (error: any) {
    console.error('Error searching models:', error)
    return NextResponse.json({ error: error.message || 'Error al buscar modelos' }, { status: 500 })
  }
}
