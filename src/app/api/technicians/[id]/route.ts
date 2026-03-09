import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * Endpoint para actualizar asignaciones y estado de un técnico
 * NOTA: Los datos personales (nombre, email, teléfono, departamento) 
 * solo se pueden editar desde el módulo de usuarios
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const params = await context.params
    const technicianId = params.id
    const body = await request.json()

    // Verificar que el técnico existe
    const technician = await prisma.users.findUnique({
      where: { 
        id: technicianId,
        role: 'TECHNICIAN'
      }
    })

    if (!technician) {
      return NextResponse.json(
        { success: false, error: 'Técnico no encontrado' },
        { status: 404 }
      )
    }

    const { isActive, assignments } = body

    // Solo actualizar estado si se proporciona
    if (typeof isActive === 'boolean') {
      await prisma.users.update({
        where: { id: technicianId },
        data: {
          isActive,
          updatedAt: new Date()
        }
      })
    }

    // Si hay asignaciones, actualizarlas
    if (assignments && Array.isArray(assignments)) {
      // Desactivar todas las asignaciones actuales
      await prisma.technician_assignments.updateMany({
        where: { technicianId },
        data: { isActive: false }
      })

      // Crear o actualizar las nuevas asignaciones
      for (const assignment of assignments) {
        const { categoryId, priorityLevel, maxTickets } = assignment

        // Buscar si ya existe una asignación para esta categoría
        const existingAssignment = await prisma.technician_assignments.findFirst({
          where: {
            technicianId,
            categoryId
          }
        })

        if (existingAssignment) {
          // Actualizar la asignación existente
          await prisma.technician_assignments.update({
            where: { id: existingAssignment.id },
            data: {
              priority: priorityLevel,
              maxTickets,
              isActive: true,
              updatedAt: new Date()
            }
          })
        } else {
          // Crear nueva asignación
          await prisma.technician_assignments.create({
            data: {
              id: randomUUID(),
              technicianId,
              categoryId,
              priority: priorityLevel,
              maxTickets,
              isActive: true,
              autoAssign: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })
        }
      }
    }

    // Obtener el técnico actualizado con sus asignaciones
    const updatedTechnician = await prisma.users.findUnique({
      where: { id: technicianId },
      include: {
        departments: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        technician_assignments: {
          where: { isActive: true },
          include: {
            categories: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          }
        }
      }
    })

    // Transformar a formato camelCase para el frontend
    const normalizedTechnician = updatedTechnician ? {
      ...updatedTechnician,
      department: updatedTechnician.departments,
      technicianAssignments: updatedTechnician.technician_assignments?.map(assignment => ({
        ...assignment,
        category: assignment.categories
      }))
    } : null

    // Registrar en auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'technician_assignments_updated',
        entityType: 'User',
        entityId: technicianId,
        userId: session.user.id,
        details: {
          technicianName: technician.name,
          technicianEmail: technician.email,
          updatedFields: {
            isActive: typeof isActive === 'boolean' ? isActive : undefined,
            assignmentsCount: assignments?.length || 0
          }
        },
        createdAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Asignaciones del técnico actualizadas exitosamente',
      data: normalizedTechnician
    })
  } catch (error) {
    console.error('[CRITICAL] Error updating technician assignments:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al actualizar asignaciones del técnico',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * Endpoint para obtener información de un técnico
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const params = await context.params
    const technicianId = params.id

    const technician = await prisma.users.findUnique({
      where: { 
        id: technicianId,
        role: 'TECHNICIAN'
      },
      include: {
        departments: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        technician_assignments: {
          where: { isActive: true },
          include: {
            categories: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          }
        },
        _count: {
          select: {
            tickets_tickets_assigneeIdTousers: {
              where: {
                status: {
                  in: ['OPEN', 'IN_PROGRESS']
                }
              }
            }
          }
        }
      }
    })

    if (!technician) {
      return NextResponse.json(
        { success: false, error: 'Técnico no encontrado' },
        { status: 404 }
      )
    }

    // Transformar a formato camelCase para el frontend
    const normalizedTechnician = {
      ...technician,
      department: technician.departments,
      technicianAssignments: technician.technician_assignments?.map(assignment => ({
        ...assignment,
        category: assignment.categories
      }))
    }

    return NextResponse.json({
      success: true,
      data: normalizedTechnician
    })
  } catch (error) {
    console.error('[CRITICAL] Error fetching technician:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener técnico',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
