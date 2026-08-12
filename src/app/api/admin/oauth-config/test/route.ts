import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  'azure-ad': 'Microsoft',
}

// Verifica que el tenant de Azure AD existe y es accesible
async function verifyAzureTenant(tenantId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const metadataUrl = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
    const res = await fetch(metadataUrl, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      return {
        ok: false,
        error: `Tenant ID no reconocido por Microsoft (HTTP ${res.status}). Verifica el Id. de directorio en Azure Portal.`,
      }
    }
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: 'No se pudo contactar con login.microsoftonline.com. Verifica la red.',
    }
  }
}

// Verifica clientId + clientSecret contra Azure AD usando client_credentials
// (no requiere usuario, es una verificación pura de las credenciales de la app)
async function verifyAzureCredentials(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    })

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    })

    const data = await res.json()

    if (res.ok && data.access_token) {
      return { ok: true }
    }

    // Interpretar errores comunes de Azure AD
    const azureError = data.error as string | undefined
    const azureDesc = data.error_description as string | undefined

    if (azureError === 'invalid_client') {
      if (azureDesc?.includes('secret')) {
        return {
          ok: false,
          error:
            'Client Secret incorrecto o expirado. Genera uno nuevo en Azure Portal → Certificados y secretos.',
        }
      }
      return {
        ok: false,
        error: `Application (Client) ID no válido para este tenant. Verifica que la app esté registrada en el directorio correcto.`,
      }
    }
    if (azureError === 'unauthorized_client') {
      return {
        ok: false,
        error: 'La aplicación no tiene permisos de client_credentials en este tenant.',
      }
    }
    if (azureError === 'invalid_resource' || azureError === 'invalid_scope') {
      // El scope de Graph puede no estar habilitado, pero las credenciales son válidas
      return { ok: true }
    }

    return { ok: false, error: azureDesc || azureError || 'Credenciales rechazadas por Microsoft.' }
  } catch {
    return { ok: false, error: 'Tiempo de espera agotado al contactar con Microsoft.' }
  }
}

// Verifica clientId + clientSecret de Google usando el token info endpoint
async function verifyGoogleCredentials(
  clientId: string,
  clientSecret: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Google no tiene un endpoint de validación directa de credenciales sin usuario,
    // pero podemos intentar un token request que fallará de forma predecible si son inválidas
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: 'test_invalid_code',
        redirect_uri: 'http://localhost',
      }).toString(),
      signal: AbortSignal.timeout(8000),
    })

    const data = await res.json()

    // Si el error es sobre el código (no las credenciales), las credenciales son válidas
    if (data.error === 'invalid_grant' || data.error === 'redirect_uri_mismatch') {
      return { ok: true }
    }
    if (data.error === 'invalid_client') {
      return {
        ok: false,
        error: 'Client ID o Client Secret de Google inválidos. Verifica en Google Cloud Console.',
      }
    }

    // Cualquier otro error de flujo (no de credenciales) se considera OK
    return { ok: true }
  } catch {
    return { ok: false, error: 'No se pudo contactar con Google OAuth. Verifica la red.' }
  }
}

// POST /api/admin/oauth-config/test
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { provider } = body

    if (!provider || !['google', 'azure-ad'].includes(provider)) {
      return NextResponse.json({ success: false, error: 'Proveedor inválido.' }, { status: 400 })
    }

    const label = PROVIDER_LABELS[provider]

    // Leer config desde BD
    const config = await prisma.oauth_configs.findUnique({ where: { provider } })

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: `No hay configuración guardada para ${label}. Guarda los datos primero.`,
        },
        { status: 404 }
      )
    }

    if (!config.isEnabled) {
      return NextResponse.json(
        { success: false, error: `${label} OAuth está deshabilitado. Actívalo antes de probar.` },
        { status: 400 }
      )
    }

    if (!config.clientId || !config.clientSecret) {
      return NextResponse.json(
        {
          success: false,
          error: `La configuración de ${label} está incompleta. Verifica Client ID y Client Secret.`,
        },
        { status: 400 }
      )
    }

    // Desencriptar secret para las verificaciones
    let plainSecret: string
    try {
      plainSecret = decrypt(config.clientSecret)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Error al leer el Client Secret guardado. Vuelve a ingresarlo.' },
        { status: 500 }
      )
    }

    const diagnostics: string[] = []

    if (provider === 'azure-ad') {
      const tenant = config.tenantId || 'common'

      // Paso 1: verificar que el tenant existe
      const tenantCheck = await verifyAzureTenant(tenant)
      if (!tenantCheck.ok) {
        return NextResponse.json(
          {
            success: false,
            error: tenantCheck.error,
            step: 'tenant',
            diagnostics: [`Tenant ID usado: ${tenant}`],
          },
          { status: 400 }
        )
      }
      diagnostics.push(`Tenant verificado: ${tenant}`)

      // Paso 2: verificar clientId + clientSecret
      const credsCheck = await verifyAzureCredentials(tenant, config.clientId, plainSecret)
      if (!credsCheck.ok) {
        return NextResponse.json(
          {
            success: false,
            error: credsCheck.error,
            step: 'credentials',
            diagnostics,
          },
          { status: 400 }
        )
      }
      diagnostics.push('Client ID y Client Secret verificados correctamente')
    }

    if (provider === 'google') {
      const credsCheck = await verifyGoogleCredentials(config.clientId, plainSecret)
      if (!credsCheck.ok) {
        return NextResponse.json(
          {
            success: false,
            error: credsCheck.error,
            step: 'credentials',
            diagnostics,
          },
          { status: 400 }
        )
      }
      diagnostics.push('Client ID y Client Secret de Google verificados correctamente')
    }

    // Todo OK — devolver también la redirect URI para que el usuario confirme que está en el portal
    const baseUrl =
      request.headers.get('origin') || request.headers.get('referer')?.split('/admin')[0] || ''
    const redirectUri = config.redirectUri || `${baseUrl}/api/auth/callback/${provider}`

    return NextResponse.json({
      success: true,
      label,
      provider,
      diagnostics,
      redirectUri,
      message: `Credenciales de ${label} verificadas correctamente. Asegúrate de que la Redirect URI esté registrada en el portal.`,
    })
  } catch (error) {
    console.error('Error testing OAuth config:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno al verificar la configuración.' },
      { status: 500 }
    )
  }
}
