/**
 * API: User - Single Form
 * GET /api/forms/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const form = await prisma.forms.findUnique({
      where: { id, isActive: true },
      include: {
        category: true,
        family: true,
        createdBy: { select: { id: true, name: true } },
        _count: { select: { form_downloads: true } },
      },
    })

    if (!form) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ form })
  } catch (error) {
    console.error('Error obteniendo formulario:', error)
    return NextResponse.json({ error: 'Error al obtener documento' }, { status: 500 })
  }
}
