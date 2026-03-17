import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

/**
 * GET /api/admin/equipment-types
 * Obtiene todos los tipos de equipo (activos e inactivos)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Solo admin puede ver todos los tipos (incluyendo inactivos)
    const isAdmin = session.user.role === 'ADMIN'
    
    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where = isAdmin && includeInactive ? {} : { isActive: true }

    const types = await prisma.equipment_types.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(types, { status: 200 })
  } catch (error) {
    console.error('Error en GET /api/admin/equipment-types:', error)
    
    return NextResponse.json(
      { 
        error: 'Error al obtener tipos de equipo',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/equipment-types
 * Crea un nuevo tipo de equipo (ADMIN y TECHNICIAN)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Permitir a ADMIN y TECHNICIAN crear tipos
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') {
      return NextResponse.json(
        { error: 'No autorizado. Solo administradores y técnicos pueden crear tipos de equipo.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { code, name, description, icon, order } = body

    // Validaciones
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Código y nombre son requeridos' },
        { status: 400 }
      )
    }

    // Verificar que el código sea único
    const existing = await prisma.equipment_types.findUnique({
      where: { code: code.toUpperCase() }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un tipo de equipo con este código' },
        { status: 400 }
      )
    }

    const newType = await prisma.equipment_types.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        icon,
        order: order || 999,
        isActive: true
      }
    })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.EQUIPMENT_TYPE_CREATED,
      entityType: 'inventory',
      entityId: newType.id,
      userId: session.user.id,
      details: { code: newType.code, name: newType.name, description },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando creación de tipo de equipo:', err))

    return NextResponse.json(newType, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/admin/equipment-types:', error)
    
    return NextResponse.json(
      { 
        error: 'Error al crear tipo de equipo',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}
