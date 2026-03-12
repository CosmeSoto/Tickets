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

    return NextResponse.json(services)
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

    const service = await prisma.landing_page_services.create({
      data: body,
    })

    return NextResponse.json(service)
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json(
      { error: 'Error al crear servicio' },
      { status: 500 }
    )
  }
}
