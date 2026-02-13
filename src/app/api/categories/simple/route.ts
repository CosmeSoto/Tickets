import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')

    const where: any = {}
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // Consulta simple sin relaciones complejas
    const categories = await prisma.categories.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        level: true,
        parentId: true,
        departmentId: true,
        order: true,
        color: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { level: 'asc' },
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: categories,
      meta: {
        total: categories.length
      }
    })
  } catch (error) {
    console.error('Error in categories simple API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar las categorías',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
