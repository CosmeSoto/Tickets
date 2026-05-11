/**
 * API de migración: asigna automáticamente la familia del departamento
 * a todos los técnicos que aún no tienen esa asignación.
 *
 * POST /api/admin/migrate-technician-families
 * Solo accesible por Super Admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // Obtener todos los técnicos activos con departamento que tiene familia
    const technicians = await prisma.users.findMany({
      where: {
        role: 'TECHNICIAN',
        isActive: true,
        departmentId: { not: null },
      },
      select: {
        id: true,
        name: true,
        departmentId: true,
        departments: { select: { familyId: true, name: true } },
        technicianFamilyAssignments: {
          where: { isActive: true },
          select: { familyId: true },
        },
      },
    })

    let assigned = 0
    let skipped = 0
    const details: { technicianName: string; familyId: string }[] = []

    for (const tech of technicians) {
      const familyId = tech.departments?.familyId
      if (!familyId) {
        skipped++
        continue
      }

      // Verificar si ya tiene la asignación activa
      const alreadyAssigned = tech.technicianFamilyAssignments.some(a => a.familyId === familyId)
      if (alreadyAssigned) {
        skipped++
        continue
      }

      // Crear o reactivar la asignación
      await prisma.technician_family_assignments.upsert({
        where: { technicianId_familyId: { technicianId: tech.id, familyId } },
        create: {
          id: randomUUID(),
          technicianId: tech.id,
          familyId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        update: { isActive: true, updatedAt: new Date() },
      })

      assigned++
      details.push({ technicianName: tech.name, familyId })
    }

    return NextResponse.json({
      success: true,
      message: `Migración completada: ${assigned} asignaciones creadas, ${skipped} omitidas`,
      assigned,
      skipped,
      details,
    })
  } catch (error) {
    console.error('[MIGRATE] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
