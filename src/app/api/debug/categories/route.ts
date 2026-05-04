import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Endpoint temporal de diagnóstico — SOLO para desarrollo
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const technicianId = session.user.id

  // 1. Asignaciones del técnico
  const assignments = await prisma.technician_assignments.findMany({
    where: { technicianId, isActive: true },
    include: { categories: { select: { id: true, name: true, level: true, parentId: true } } },
  })

  const categoryIds = assignments.map(a => a.categoryId)

  // 2. Hijos y nietos
  const children =
    categoryIds.length > 0
      ? await prisma.categories.findMany({
          where: { parentId: { in: categoryIds } },
          select: { id: true, name: true, parentId: true },
        })
      : []
  const childIds = children.map(c => c.id)

  const grandchildren =
    childIds.length > 0
      ? await prisma.categories.findMany({
          where: { parentId: { in: childIds } },
          select: { id: true, name: true, parentId: true },
        })
      : []

  const allIds = [...categoryIds, ...childIds, ...grandchildren.map(c => c.id)]

  // 3. Tickets en esas categorías
  const ticketsByCategory = await prisma.tickets.groupBy({
    by: ['categoryId', 'status'],
    where: { categoryId: { in: allIds } },
    _count: { id: true },
  })

  // 4. Total de tickets en el sistema
  const totalTickets = await prisma.tickets.count()

  // 5. Muestra de tickets con sus categorías
  const sampleTickets = await prisma.tickets.findMany({
    take: 5,
    select: {
      id: true,
      title: true,
      status: true,
      categoryId: true,
      categories: { select: { name: true, level: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    technicianId,
    assignments: assignments.map(a => ({
      categoryId: a.categoryId,
      name: a.categories.name,
      level: a.categories.level,
    })),
    children: children.map(c => ({ id: c.id, name: c.name, parentId: c.parentId })),
    grandchildren: grandchildren.map(c => ({ id: c.id, name: c.name, parentId: c.parentId })),
    allCategoryIds: allIds,
    ticketsByCategory,
    totalTicketsInSystem: totalTickets,
    sampleTickets,
  })
}
