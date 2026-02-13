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

    const categoryTree = await CategoryService.getCategoryTree()
    return NextResponse.json(categoryTree)
  } catch (error) {
    console.error('Error al obtener árbol de categorías:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
