import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

// Schema de validación
const departmentSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color inválido').optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
})

// GET /api/departments - Listar departamentos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const includeCount = searchParams.get('includeCount') === 'true'

    const where: any = {}
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const departments = await prisma.departments.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ],
      include: {
        _count: {
          select: {
            users: true,
            categories: true
          }
        }
      }
    })

    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Departamentos cargados:', departments.length)
    }

    return NextResponse.json({
      success: true,
      data: departments
    })
  } catch (error) {
    console.error('❌ Error al cargar departamentos:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al cargar departamentos',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

// POST /api/departments - Crear departamento
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = departmentSchema.parse(body)

    // Verificar si ya existe un departamento con ese nombre
    const existing = await prisma.departments.findUnique({
      where: { name: validatedData.name }
    })

    if (existing) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Ya existe un departamento con ese nombre' 
        },
        { status: 400 }
      )
    }

    const department = await prisma.departments.create({
      data: {
        id: randomUUID(),
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color || '#3B82F6',
        isActive: validatedData.isActive ?? true,
        order: validatedData.order ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            users: true,
            categories: true
          }
        }
      }
    })

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.DEPARTMENT_CREATED,
      entityType: 'department',
      entityId: department.id,
      userId: session.user.id,
      details: {
        departmentName: department.name,
        description: department.description,
        color: department.color,
        isActive: department.isActive
      },
      request
    })

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Departamento creado:', department.name)
    }

    return NextResponse.json({
      success: true,
      data: department,
      message: `Departamento "${department.name}" creado exitosamente`
    })
  } catch (error) {
    console.error('❌ Error al crear departamento:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Datos inválidos',
          details: error.errors
        },
        { status: 400 }
      )
    }

    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al crear departamento',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
