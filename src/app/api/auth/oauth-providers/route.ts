import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/auth/oauth-providers
 * Endpoint público para obtener los proveedores OAuth habilitados
 * No requiere autenticación - usado en páginas de login/registro
 */
export async function GET() {
  try {
    // Obtener configuraciones OAuth habilitadas
    const configs = await prisma.oauth_configs.findMany({
      where: {
        isEnabled: true
      },
      select: {
        provider: true,
        isEnabled: true
      }
    })

    // Crear objeto con proveedores habilitados
    const enabledProviders = {
      google: configs.some(c => c.provider === 'google' && c.isEnabled),
      microsoft: configs.some(c => c.provider === 'azure-ad' && c.isEnabled), // ✅ Corregido: azure-ad en lugar de microsoft
    }

    return NextResponse.json({
      success: true,
      providers: enabledProviders
    })
  } catch (error) {
    console.error('Error fetching OAuth providers:', error)
    
    // En caso de error, devolver todos deshabilitados
    return NextResponse.json({
      success: true,
      providers: {
        google: false,
        microsoft: false
      }
    })
  }
}
