import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const PROVIDER_AUTH_URLS: Record<string, (tenantId?: string | null) => string> = {
  google: () => 'https://accounts.google.com/o/oauth2/v2/auth',
  'azure-ad': tenantId => {
    const tenant =
      tenantId && tenantId !== 'common' && tenantId !== 'consumers'
        ? tenantId
        : tenantId || 'common'
    return `https://login.microsoftonline.com/${tenant}/v2.0/authorize`
  },
}

const PROVIDER_SCOPES: Record<string, string> = {
  google: 'openid profile email',
  'azure-ad': 'openid profile email User.Read',
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  'azure-ad': 'Microsoft',
}

// POST /api/admin/oauth-config/test
// Valida que la configuración del proveedor esté completa y habilitada,
// y devuelve la URL de autorización para iniciar el flujo real en el cliente.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { provider } = body

    if (!provider || !['google', 'azure-ad'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Proveedor inválido. Usa "google" o "azure-ad".' },
        { status: 400 }
      )
    }

    // Leer config desde BD
    const config = await prisma.oauth_configs.findUnique({ where: { provider } })

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: `No hay configuración guardada para ${PROVIDER_LABELS[provider]}. Guarda los datos primero.`,
        },
        { status: 404 }
      )
    }

    if (!config.isEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: `${PROVIDER_LABELS[provider]} OAuth está deshabilitado. Actívalo antes de probar.`,
        },
        { status: 400 }
      )
    }

    if (!config.clientId || !config.clientSecret) {
      return NextResponse.json(
        {
          success: false,
          error: `La configuración de ${PROVIDER_LABELS[provider]} está incompleta. Verifica Client ID y Client Secret.`,
        },
        { status: 400 }
      )
    }

    // Construir la URL de autorización real (mismo flujo que usaría NextAuth)
    const baseUrl =
      request.headers.get('origin') || request.headers.get('referer')?.split('/admin')[0] || ''
    const redirectUri = config.redirectUri || `${baseUrl}/api/auth/callback/${provider}`
    const scopes = config.scopes || PROVIDER_SCOPES[provider]
    const authBaseUrl = PROVIDER_AUTH_URLS[provider](config.tenantId)

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes,
      // state aleatorio para CSRF — el popup no completará el flow real,
      // pero si el proveedor devuelve la pantalla de login, la config es correcta
      state: `oauth_test_${Date.now()}`,
      prompt: 'select_account',
    })

    const authUrl = `${authBaseUrl}?${params.toString()}`

    return NextResponse.json({
      success: true,
      provider,
      label: PROVIDER_LABELS[provider],
      authUrl,
      clientId: config.clientId,
      tenantId: config.tenantId,
      redirectUri,
    })
  } catch (error) {
    console.error('Error testing OAuth config:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno al verificar la configuración.' },
      { status: 500 }
    )
  }
}
