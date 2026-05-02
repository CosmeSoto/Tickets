import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * GET /api/client-family-assignments?clientId=xxx
 * Lista las asignaciones de familias de un cliente.
 * Incluye activeTickets por familia para mostrar en la UI.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    if (!clientId) return NextResponse.json({ error: 'clientId requerido' }, { status: 400 })

    const assignments = await prisma.client_family_assignments.findMany({
      where: { clientId },
      include: {
        family: {
          select: { id: true, name: true, code: true, color: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Contar tickets activos del cliente por familia (para mostrar badge en UI)
    const familyIds = assignments.map(a => a.familyId)
    const activeTicketCounts =
      familyIds.length > 0
        ? await prisma.tickets.groupBy({
            by: ['familyId'],
            where: {
              clientId,
              familyId: { in: familyIds },
              status: { notIn: ['RESOLVED', 'CLOSED'] },
            },
            _count: { id: true },
          })
        : []

    const ticketMap = Object.fromEntries(activeTicketCounts.map(t => [t.familyId, t._count.id]))

    return NextResponse.json({
      success: true,
      data: assignments.map(a => ({
        ...a,
        activeTickets: ticketMap[a.familyId] ?? 0,
      })),
    })
  } catch (error) {
    console.error('[GET /api/client-family-assignments]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/client-family-assignments
 * Body: { clientId, familyId }
 * Crea una asignación cliente-familia.
 * HTTP 409 si ya existe.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { clientId, familyId } = await request.json()
    if (!clientId || !familyId)
      return NextResponse.json({ error: 'clientId y familyId son requeridos' }, { status: 400 })

    // Validar que el usuario existe y es CLIENT
    const user = await prisma.users.findUnique({
      where: { id: clientId },
      select: { id: true, role: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    if (user.role !== 'CLIENT')
      return NextResponse.json(
        { error: 'Solo se pueden asignar familias a usuarios con rol CLIENT' },
        { status: 400 }
      )

    // Validar que la familia existe y está activa
    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { id: true, isActive: true },
    })
    if (!family) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    if (!family.isActive)
      return NextResponse.json({ error: 'La familia no está activa' }, { status: 400 })

    // Verificar duplicado
    const existing = await prisma.client_family_assignments.findUnique({
      where: { clientId_familyId: { clientId, familyId } },
    })
    if (existing) {
      // Si existe pero está inactiva, reactivar
      if (!existing.isActive) {
        const reactivated = await prisma.client_family_assignments.update({
          where: { clientId_familyId: { clientId, familyId } },
          data: { isActive: true },
        })
        await invalidateClientCache(clientId)
        return NextResponse.json({ success: true, data: reactivated }, { status: 200 })
      }
      return NextResponse.json(
        { error: 'El cliente ya está asignado a esta familia' },
        { status: 409 }
      )
    }

    const assignment = await prisma.client_family_assignments.create({
      data: { id: randomUUID(), clientId, familyId, isActive: true },
      include: {
        family: { select: { id: true, name: true, code: true, color: true, isActive: true } },
      },
    })

    await invalidateClientCache(clientId)

    return NextResponse.json({ success: true, data: assignment }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/client-family-assignments]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

async function invalidateClientCache(clientId: string) {
  try {
    const { invalidateCache } = await import('@/lib/api-cache')
    await invalidateCache(`user:modules:${clientId}`)
  } catch {
    /* Redis no disponible */
  }
}
