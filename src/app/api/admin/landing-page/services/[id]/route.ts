import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { icon, iconColor, title, description, enabled } = body

    const service = await prisma.landing_page_services.update({
      where: { id: params.id },
      data: {
        ...(icon && { icon }),
        ...(iconColor && { icon_color: iconColor }),
        ...(title && { title }),
        ...(description && { description }),
        ...(enabled !== undefined && { enabled }),
      },
    })

    return NextResponse.json({
      id: service.id,
      icon: service.icon,
      iconColor: service.icon_color,
      title: service.title,
      description: service.description,
      order: service.order,
      enabled: service.enabled,
    })
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json(
      { error: 'Error al actualizar servicio' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await prisma.landing_page_services.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json(
      { error: 'Error al eliminar servicio' },
      { status: 500 }
    )
  }
}
