/**
 * Endpoint público para obtener el timeout de sesión configurado
 * No requiere autenticación ya que es información necesaria para todos los usuarios
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const DEFAULT_SESSION_TIMEOUT = 1440 // 24 horas en minutos

export async function GET() {
  try {
    // Buscar configuración de sessionTimeout
    const setting = await prisma.system_settings.findFirst({
      where: { key: 'sessionTimeout' }
    })

    const sessionTimeout = setting 
      ? parseInt(setting.value) 
      : DEFAULT_SESSION_TIMEOUT

    return NextResponse.json({ 
      sessionTimeout,
      success: true 
    })
  } catch (error) {
    console.error('[API] Error obteniendo session timeout:', error)
    
    // En caso de error, retornar valor por defecto
    return NextResponse.json({ 
      sessionTimeout: DEFAULT_SESSION_TIMEOUT,
      success: true,
      fallback: true
    })
  }
}
