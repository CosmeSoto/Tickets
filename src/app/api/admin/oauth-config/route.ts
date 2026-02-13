import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'
import { randomUUID } from 'crypto'

// GET - Obtener configuraciones OAuth
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const configs = await prisma.oauth_configs.findMany({
      orderBy: { provider: 'asc' }
    })

    // Si no hay configuraciones, retornar array vacío
    if (!configs || configs.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Desencriptar client secrets para mostrar (parcialmente)
    const configsWithMaskedSecrets = configs.map(config => ({
      id: config.id,
      provider: config.provider,
      clientId: config.clientId,
      clientSecret: config.clientSecret ? '••••••••' : '',
      tenantId: config.tenantId,
      isEnabled: config.isEnabled,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      updatedAt: config.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      data: configsWithMaskedSecrets
    })
  } catch (error) {
    console.error('Error fetching OAuth configs:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      encryptionKeySet: !!process.env.ENCRYPTION_KEY
    })
    return NextResponse.json(
      { success: false, error: 'Error al obtener configuraciones' },
      { status: 500 }
    )
  }
}

// POST - Crear o actualizar configuración OAuth
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { provider, clientId, clientSecret, tenantId, isEnabled, redirectUri, scopes } = body

    // Validaciones
    if (!provider || !clientId || !clientSecret) {
      return NextResponse.json(
        { success: false, error: 'Provider, clientId y clientSecret son requeridos' },
        { status: 400 }
      )
    }

    if (!['google', 'azure-ad'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Provider inválido. Debe ser "google" o "azure-ad"' },
        { status: 400 }
      )
    }

    // Encriptar client secret
    const encryptedSecret = encrypt(clientSecret)

    // Crear o actualizar configuración
    const config = await prisma.oauth_configs.upsert({
      where: { provider },
      create: {
        id: randomUUID(),
        provider,
        clientId,
        clientSecret: encryptedSecret,
        tenantId: tenantId || null,
        isEnabled: isEnabled ?? false,
        redirectUri: redirectUri || null,
        scopes: scopes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        clientId,
        clientSecret: encryptedSecret,
        tenantId: tenantId || null,
        isEnabled: isEnabled ?? false,
        redirectUri: redirectUri || null,
        scopes: scopes || null,
        updatedAt: new Date(),
      }
    })

    return NextResponse.json({
      success: true,
      message: `Configuración de ${provider} guardada exitosamente`,
      data: {
        id: config.id,
        provider: config.provider,
        isEnabled: config.isEnabled,
      }
    })
  } catch (error) {
    console.error('Error saving OAuth config:', error)
    return NextResponse.json(
      { success: false, error: 'Error al guardar configuración' },
      { status: 500 }
    )
  }
}

// PUT - Activar/desactivar proveedor
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { provider, isEnabled } = body

    if (!provider || typeof isEnabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Provider e isEnabled son requeridos' },
        { status: 400 }
      )
    }

    const config = await prisma.oauth_configs.update({
      where: { provider },
      data: { isEnabled }
    })

    return NextResponse.json({
      success: true,
      message: `Proveedor ${provider} ${isEnabled ? 'activado' : 'desactivado'}`,
      data: {
        provider: config.provider,
        isEnabled: config.isEnabled,
      }
    })
  } catch (error) {
    console.error('Error updating OAuth config:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar configuración' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar configuración OAuth
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider')

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider es requerido' },
        { status: 400 }
      )
    }

    await prisma.oauth_configs.delete({
      where: { provider }
    })

    return NextResponse.json({
      success: true,
      message: `Configuración de ${provider} eliminada`
    })
  } catch (error) {
    console.error('Error deleting OAuth config:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar configuración' },
      { status: 500 }
    )
  }
}
