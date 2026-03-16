import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const services = await prisma.landing_page_services.findMany({
      orderBy: { order: 'asc' },
    })

    // Mapear a formato frontend
    const mapped = services.map(s => ({
      id: s.id,
      icon: s.icon,
      iconColor: s.iconColor,
      title: s.title,
      description: s.description,
      order: s.order,
      enabled: s.enabled,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('Error loading services:', error)
    return NextResponse.json(
      { error: 'Error al cargar servicios' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { icon, iconColor, title, description } = body

    // Calcular el siguiente orden
    const maxOrder = await prisma.landing_page_services.aggregate({
      _max: { order: true },
    })

    const service = await prisma.landing_page_services.create({
      data: {
        icon,
        iconColor: iconColor || 'blue',
        title,
        description,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    })

    return NextResponse.json({
      id: service.id,
      icon: service.icon,
      iconColor: service.iconColor,
      title: service.title,
      description: service.description,
      order: service.order,
      enabled: service.enabled,
    })
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json(
      { error: 'Error al crear servicio' },
      { status: 500 }
    )
  }
}
