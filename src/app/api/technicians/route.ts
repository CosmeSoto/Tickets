import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const isActive = searchParams.get('isActive')
    const role = searchParams.get('role')

    // Construir filtros
    const where: any = {}

    if (departmentId) {
      where.departmentId = departmentId
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    if (role) {
      where.role = role
    } else {
      // Por defecto, solo técnicos y admins
      where.role = {
        in: ['TECHNICIAN', 'ADMIN']
      }
    }

    // Obtener técnicos
    const technicians = await prisma.users.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
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
      },
      orderBy: [
        { name: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: technicians,
      meta: {
        total: technicians.length,
        filters: {
          departmentId,
          isActive,
          role
        }
      }
    })
  } catch (error) {
    console.error('Error in technicians API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar los técnicos',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, email, phone, departmentId, role, password } = body

    // Validaciones
    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Nombre, email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    // Verificar si el email ya existe
    const existingUser = await prisma.users.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'El email ya está registrado' },
        { status: 400 }
      )
    }

    // Crear técnico
    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash(password, 10)

    const technician = await prisma.users.create({
      data: {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        email,
        phone: phone || null,
        passwordHash: hashedPassword,
        role: role || 'TECHNICIAN',
        departmentId: departmentId || null,
        isActive: true,
        isEmailVerified: true,
        createdAt: new Date(),
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
        departments: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: technician,
      message: 'Técnico creado exitosamente'
    })
  } catch (error) {
    console.error('Error creating technician:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear el técnico',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
