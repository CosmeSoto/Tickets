import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// Esquema para promoción de usuario a técnico
const promoteUserSchema = z.object({
  departmentId: z.string().optional().nullable(),
  assignedCategories: z.array(z.object({
    categoryId: z.string().min(1, 'ID de categoría requerido'),
    priority: z.number().min(1, 'Prioridad mínima es 1').max(10, 'Prioridad máxima es 10'),
    maxTickets: z.number().optional().nullable(),
    autoAssign: z.boolean().default(false)
  })).optional().default([]),
})

/**
 * Endpoint para promover un usuario CLIENT a TECHNICIAN
 * Solo el admin puede realizar esta operación
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('⬆️ [API-USER-PROMOTE] POST - ID:', id)
    
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar que el usuario existe y es CLIENT
    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        isActive: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    if (user.role !== 'CLIENT') {
      return NextResponse.json(
        { success: false, error: 'Solo los clientes pueden ser promovidos a técnicos' },
        { status: 400 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'No se puede promover un usuario inactivo' },
        { status: 400 }
      )
    }

    // VALIDACIÓN CRÍTICA: Verificar que no tenga tickets pendientes
    const pendingTicketsCount = await prisma.tickets.count({
      where: {
        clientId: id,
        status: {
          in: ['OPEN', 'IN_PROGRESS']
        }
      }
    })

    if (pendingTicketsCount > 0) {
      console.log(`❌ [API-USER-PROMOTE] Usuario tiene ${pendingTicketsCount} tickets pendientes`)
      return NextResponse.json(
        { 
          success: false, 
          error: 'No se puede promover el usuario',
          details: {
            reason: 'pending_tickets',
            message: `El usuario tiene ${pendingTicketsCount} ticket(s) pendiente(s). Debe cerrar o reasignar todos sus tickets antes de ser promovido a técnico.`,
            pendingTickets: pendingTicketsCount
          }
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    console.log('📝 [API-USER-PROMOTE] Datos recibidos:', JSON.stringify(body, null, 2))
    
    let validatedData
    try {
      validatedData = promoteUserSchema.parse(body)
      console.log('✅ [API-USER-PROMOTE] Datos validados:', JSON.stringify(validatedData, null, 2))
    } catch (validationError) {
      console.error('❌ [API-USER-PROMOTE] Error de validación:', validationError)
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

    // Promover usuario a técnico
    const promotedUser = await prisma.users.update({
      where: { id },
      data: {
        role: 'TECHNICIAN',
        departmentId: validatedData.departmentId || user.departmentId,
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
        _count: {
          select: {
            tickets_tickets_assigneeIdTousers: true,
            technician_assignments: true
          }
        }
      }
    })

    // Crear asignaciones de categorías si se proporcionaron
    if (validatedData.assignedCategories && validatedData.assignedCategories.length > 0) {
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

      // Recargar el usuario con las nuevas asignaciones
      const userWithAssignments = await prisma.users.findUnique({
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

      if (userWithAssignments) {
        // Registrar auditoría
        try {
          await AuditServiceComplete.log({
            userId: session.user.id,
            action: AuditActionsComplete.TECHNICIAN_PROMOTED,
            entityType: 'user',
            entityId: id,
            details: {
              userName: user.name,
              userEmail: user.email,
              previousRole: 'CLIENT',
              newRole: 'TECHNICIAN',
              departmentId: validatedData.departmentId,
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

        const enrichedUser = {
          ...userWithAssignments,
          canDelete: false, // Los técnicos no se eliminan, se degradan
          technicianAssignments: userWithAssignments.technician_assignments.map(assignment => ({
            id: assignment.id,
            priority: assignment.priority,
            maxTickets: assignment.maxTickets,
            autoAssign: assignment.autoAssign,
            category: assignment.categories
          }))
        }
        
        console.log('✅ [API-USER-PROMOTE] Usuario promovido con categorías:', user.name)
        
        // Invalidar cache de usuarios
        try {
          const { invalidateCache } = await import('@/lib/api-cache')
          await invalidateCache(['users:*'])
        } catch { /* Redis no disponible */ }
        
        return NextResponse.json({
          success: true,
          data: enrichedUser,
          message: `${user.name} ha sido promovido a técnico exitosamente`
        })
      }
    }

    // Registrar auditoría
    try {
      await AuditServiceComplete.log({
        userId: session.user.id,
        action: AuditActionsComplete.TECHNICIAN_PROMOTED,
        entityType: 'user',
        entityId: id,
        details: {
          userName: user.name,
          userEmail: user.email,
          previousRole: 'CLIENT',
          newRole: 'TECHNICIAN',
          departmentId: validatedData.departmentId
        },
        metadata: {
          userAgent: request.headers.get('user-agent') || 'Unknown',
          ip: request.headers.get('x-forwarded-for') || 'Unknown'
        }
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }
    
    const enrichedUser = {
      ...promotedUser,
      canDelete: false, // Los técnicos no se eliminan, se degradan
      technicianAssignments: []
    }
    
    console.log('✅ [API-USER-PROMOTE] Usuario promovido:', user.name)
    
    // Invalidar cache de usuarios
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await invalidateCache(['users:*'])
    } catch { /* Redis no disponible */ }
    
    return NextResponse.json({
      success: true,
      data: enrichedUser,
      message: `${user.name} ha sido promovido a técnico exitosamente`
    })
    
  } catch (error) {
    console.error('❌ [API-USER-PROMOTE] Error POST:', error)
    
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