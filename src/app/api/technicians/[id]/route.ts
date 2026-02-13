import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// Esquema de validación para actualización de técnicos
// NOTA: Algunos campos sensibles (email, nombre, departamento) solo se pueden cambiar desde /api/users
const updateTechnicianSchema = z.object({
  // Solo se permiten cambios en asignaciones de categorías y estado activo
  isActive: z.boolean().default(true),
  assignedCategories: z.array(z.object({
    categoryId: z.string().min(1, 'ID de categoría requerido'),
    priority: z.number().min(1, 'Prioridad mínima es 1').max(10, 'Prioridad máxima es 10'),
    maxTickets: z.number().optional().nullable(),
    autoAssign: z.boolean().default(false)
  })).optional().default([]),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('🔍 [API-TECHNICIAN] GET - ID:', id)
    
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener técnico específico
    const technician = await prisma.users.findUnique({
      where: { 
        id,
        role: { in: ['TECHNICIAN', 'ADMIN'] }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        departments: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true
          }
        },
        technician_assignments: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            categoryId: true,
            priority: true,
            maxTickets: true,
            autoAssign: true,
            categories: {
              select: {
                id: true,
                name: true,
                color: true,
                level: true
              }
            }
          }
        },
        _count: {
          select: {
            tickets_tickets_assigneeIdTousers: true,
            technician_assignments: true
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

    // Enriquecer datos
    const enrichedTechnician = {
      ...technician,
      canDelete: technician._count.tickets_tickets_assigneeIdTousers === 0,
      technicianAssignments: technician.technician_assignments.map(assignment => ({
        id: assignment.id,
        priority: assignment.priority,
        maxTickets: assignment.maxTickets,
        autoAssign: assignment.autoAssign,
        category: assignment.categories
      }))
    }

    console.log('✅ [API-TECHNICIAN] Técnico encontrado:', technician.name)

    return NextResponse.json({
      success: true,
      data: enrichedTechnician
    })
  } catch (error) {
    console.error('❌ [API-TECHNICIAN] Error GET:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('🔄 [API-TECHNICIAN] PUT - ID:', id)
    
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar que el técnico existe
    const existingTechnician = await prisma.users.findUnique({
      where: { 
        id,
        role: { in: ['TECHNICIAN', 'ADMIN'] }
      },
      select: { 
        id: true, 
        name: true, 
        email: true,
        phone: true,
        departmentId: true,
        isActive: true
      }
    })

    if (!existingTechnician) {
      return NextResponse.json(
        { success: false, error: 'Técnico no encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    console.log('📝 [API-TECHNICIAN] Datos recibidos:', JSON.stringify(body, null, 2))
    
    let validatedData
    try {
      validatedData = updateTechnicianSchema.parse(body)
      console.log('✅ [API-TECHNICIAN] Datos validados:', JSON.stringify(validatedData, null, 2))
    } catch (validationError) {
      console.error('❌ [API-TECHNICIAN] Error de validación:', validationError)
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Datos inválidos', 
            details: validationError.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
              code: e.code
            }))
          },
          { status: 400 }
        )
      }
      throw validationError
    }
    
    // Verificar email único (excluyendo el técnico actual)
    // NOTA: Los cambios de datos personales se hacen desde /api/users
    
    // Detectar cambios para auditoría
    const changes: Record<string, { old: any, new: any }> = {}
    if (validatedData.isActive !== existingTechnician.isActive) {
      changes.isActive = { old: existingTechnician.isActive, new: validatedData.isActive }
    }
    
    // Actualizar solo el estado activo del técnico
    const updatedTechnician = await prisma.users.update({
      where: { id },
      data: {
        isActive: validatedData.isActive,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        departments: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true
          }
        },
        technician_assignments: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            categoryId: true,
            priority: true,
            maxTickets: true,
            autoAssign: true,
            categories: {
              select: {
                id: true,
                name: true,
                color: true,
                level: true
              }
            }
          }
        },
        _count: {
          select: {
            tickets_tickets_assigneeIdTousers: true,
            technician_assignments: true
          }
        }
      }
    })

    // Actualizar asignaciones de categorías si se proporcionaron
    if (validatedData.assignedCategories !== undefined) {
      // Desactivar todas las asignaciones existentes
      await prisma.technician_assignments.updateMany({
        where: { technicianId: id },
        data: { isActive: false, updatedAt: new Date() }
      })

      // Crear nuevas asignaciones
      if (validatedData.assignedCategories.length > 0) {
        await prisma.technician_assignments.createMany({
          data: validatedData.assignedCategories.map(assignment => ({
            id: randomUUID(),
            technicianId: id,
            categoryId: assignment.categoryId,
            priority: assignment.priority,
            maxTickets: assignment.maxTickets,
            autoAssign: assignment.autoAssign,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          skipDuplicates: true
        })
      }

      // Recargar el técnico con las nuevas asignaciones
      const technicianWithNewAssignments = await prisma.users.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          departmentId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          departments: {
            select: {
              id: true,
              name: true,
              color: true,
              description: true
            }
          },
          technician_assignments: {
            where: {
              isActive: true
            },
            select: {
              id: true,
              categoryId: true,
              priority: true,
              maxTickets: true,
              autoAssign: true,
              categories: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  level: true
                }
              }
            }
          },
          _count: {
            select: {
              tickets_tickets_assigneeIdTousers: true,
              technician_assignments: true
            }
          }
        }
      })

      if (technicianWithNewAssignments) {
        // Registrar auditoría
        try {
          await AuditServiceComplete.log({
            userId: session.user.id,
            action: AuditActionsComplete.TECHNICIAN_UPDATED,
            entityType: 'technician',
            entityId: id,
            details: {
              technicianName: existingTechnician.name,
              changes,
              assignedCategories: validatedData.assignedCategories.length
            },
            metadata: {
              userAgent: request.headers.get('user-agent') || 'Unknown',
              ip: request.headers.get('x-forwarded-for') || 'Unknown'
            }
          })
        } catch (auditError) {
          console.error('Error registrando auditoría:', auditError)
        }

        const enrichedTechnician = {
          ...technicianWithNewAssignments,
          canDelete: technicianWithNewAssignments._count.tickets_tickets_assigneeIdTousers === 0,
          technicianAssignments: technicianWithNewAssignments.technician_assignments.map(assignment => ({
            id: assignment.id,
            priority: assignment.priority,
            maxTickets: assignment.maxTickets,
            autoAssign: assignment.autoAssign,
            category: assignment.categories
          }))
        }
        
        console.log('✅ [API-TECHNICIAN] Técnico actualizado con categorías:', technicianWithNewAssignments.name)
        
        return NextResponse.json({
          success: true,
          data: enrichedTechnician,
          message: 'Técnico actualizado exitosamente'
        })
      }
    }

    // Registrar auditoría
    try {
      await AuditServiceComplete.log({
        userId: session.user.id,
        action: AuditActionsComplete.TECHNICIAN_UPDATED,
        entityType: 'technician',
        entityId: id,
        details: {
          technicianName: existingTechnician.name,
          changes
        },
        metadata: {
          userAgent: request.headers.get('user-agent') || 'Unknown',
          ip: request.headers.get('x-forwarded-for') || 'Unknown'
        }
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }
    
    const enrichedTechnician = {
      ...updatedTechnician,
      canDelete: updatedTechnician._count.tickets_tickets_assigneeIdTousers === 0,
      technicianAssignments: updatedTechnician.technician_assignments.map(assignment => ({
        id: assignment.id,
        priority: assignment.priority,
        maxTickets: assignment.maxTickets,
        autoAssign: assignment.autoAssign,
        category: assignment.categories
      }))
    }
    
    console.log('✅ [API-TECHNICIAN] Técnico actualizado:', updatedTechnician.name)
    
    return NextResponse.json({
      success: true,
      data: enrichedTechnician,
      message: 'Técnico actualizado exitosamente'
    })
    
  } catch (error) {
    console.error('❌ [API-TECHNICIAN] Error PUT:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Datos inválidos', 
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('🗑️ [API-TECHNICIAN] DELETE - ID:', id)
    
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Los técnicos no se eliminan, se degradan a CLIENT
    // Redirigir al endpoint de demote
    return NextResponse.json(
      { 
        success: false, 
        error: 'Los técnicos no se pueden eliminar. Use el endpoint de degradación para convertirlos a clientes.',
        redirect: `/api/users/${id}/demote`
      },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('❌ [API-TECHNICIAN] Error DELETE:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}