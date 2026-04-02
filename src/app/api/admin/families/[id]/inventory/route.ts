import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * PATCH /api/admin/families/[id]/inventory
 * Upsert de inventory_family_config
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id } = await params

    const family = await prisma.families.findUnique({ where: { id } })
    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const body = await request.json()

    if (
      body.defaultResidualValuePct !== undefined &&
      (body.defaultResidualValuePct < 0 || body.defaultResidualValuePct > 100)
    ) {
      return NextResponse.json(
        { error: 'El porcentaje de valor residual debe estar entre 0 y 100' },
        { status: 422 }
      )
    }

    const existing = await prisma.inventory_family_config.findUnique({ where: { familyId: id } })

    if (!existing) {
      const created = await prisma.inventory_family_config.create({
        data: { id: randomUUID(), familyId: id, ...body },
      })
      return NextResponse.json(created, { status: 201 })
    }

    const updated = await prisma.inventory_family_config.update({
      where: { familyId: id },
      data: body,
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error upserting inventory config:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
