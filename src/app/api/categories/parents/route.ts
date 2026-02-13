import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CategoryService } from '@/lib/services/category-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const excludeId = searchParams.get('exclude') || undefined

    const parents = await CategoryService.getAvailableParents(excludeId)
    return NextResponse.json(parents)
  } catch (error) {
    console.error('Error al obtener categorías padre:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
