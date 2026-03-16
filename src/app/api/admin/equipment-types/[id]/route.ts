import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * PUT /api/admin/equipment-types/[id]
 * Actualiza un tipo de equipo (ADMIN y TECHNICIAN)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Permitir a ADMIN y TECHNICIAN actualizar tipos
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      )
    }

    const { id } = params
    const body = await request.json()
    const { name, description, icon, order, isActive } = body

    const updated = await prisma.equipment_types.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive })
      }
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    console.error('Error en PUT /api/admin/equipment-types/[id]:', error)
    
    return NextResponse.json(
      { 
        error: 'Error al actualizar tipo de equipo',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/equipment-types/[id]
 * Elimina (desactiva) un tipo de equipo (solo ADMIN)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Solo ADMIN puede eliminar tipos (más restrictivo)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado. Solo administradores pueden eliminar tipos de equipo.' },
        { status: 403 }
      )
    }

    const { id } = params

    // Verificar si hay equipos usando este tipo
    const equipmentCount = await prisma.equipment.count({
      where: { typeId: id }
    })

    if (equipmentCount > 0) {
      // No eliminar, solo desactivar
      const updated = await prisma.equipment_types.update({
        where: { id },
        data: { isActive: false }
      })

      return NextResponse.json({
        message: `Tipo desactivado. ${equipmentCount} equipos usan este tipo.`,
        type: updated
      }, { status: 200 })
    }

    // Si no hay equipos, eliminar permanentemente
    await prisma.equipment_types.delete({
      where: { id }
    })

    return NextResponse.json({
      message: 'Tipo eliminado permanentemente'
    }, { status: 200 })
  } catch (error) {
    console.error('Error en DELETE /api/admin/equipment-types/[id]:', error)
    
    return NextResponse.json(
      { 
        error: 'Error al eliminar tipo de equipo',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}
