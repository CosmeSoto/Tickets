import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConfigService } from '@/lib/services/config-service'

// API para administradores - obtener configuración completa del sistema de ayuda
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const config = await ConfigService.getHelpSystemConfig()

    return NextResponse.json({
      success: true,
      data: config
    })
  } catch (error) {
    console.error('Error fetching admin help config:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}

// API para administradores - actualizar configuración del sistema de ayuda
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validar que los datos requeridos estén presentes
    if (!body.supportEmail || !body.companyName) {
      return NextResponse.json({ 
        success: false,
        error: 'Email de soporte y nombre de empresa son requeridos' 
      }, { status: 400 })
    }

    await ConfigService.updateHelpSystemConfig(body)

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada exitosamente'
    })
  } catch (error) {
    console.error('Error updating admin help config:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}