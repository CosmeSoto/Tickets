import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/inventory/equipment/count
 * Cuenta equipos con filtros
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('modelId')
    const batchId = searchParams.get('batchId')
    const familyId = searchParams.get('familyId')
    const status = searchParams.get('status')?.split(',')

    const where: any = {}

    if (modelId) where.modelId = modelId
    if (batchId) where.batchId = batchId
    if (familyId && familyId !== 'all') where.familyId = familyId
    if (status && status.length > 0) where.status = { in: status }

    const count = await prisma.equipment.count({ where })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error counting equipment:', error)
    return NextResponse.json({ error: 'Error al contar equipos' }, { status: 500 })
  }
}
