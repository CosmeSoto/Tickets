import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import prisma from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  'azure-ad': 'Microsoft',
  'azure-ad-sharepoint': 'Microsoft (SharePoint)',
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

// Microsoft documenta explícitamente que el endpoint multi-tenant no debe
// usarse con el flujo client_credentials: es un flujo desatendido que
// necesita saber para qué tenant específico emitir el token, cosa que
// 'common'/'organizations'/'consumers' no resuelven. Probar credenciales
// delegadas (login, Planner) con ese grant contra esos alias no valida nada
// de forma confiable — puede fallar o pasar sin relación real con si el
// Client Secret es correcto.
const MULTI_TENANT_ALIASES = new Set(['common', 'organizations', 'consumers'])

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
    const check = await requireSuperAdmin(session)
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: check.status })
    }

    const body = await request.json()
    const { provider } = body

    if (!provider || !['google', 'azure-ad', 'azure-ad-sharepoint'].includes(provider)) {
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

    // Con reuse activo, el Client ID/Secret/Tenant ID reales viven en la fila
    // 'azure-ad', no en esta — mismo criterio que getOAuthCredentials en
    // oauth-config.ts, para no duplicar la lógica de "de dónde salen".
    let effectiveClientId = config.clientId
    let effectiveClientSecretEncrypted = config.clientSecret
    let effectiveTenantId = config.tenantId
    if (provider === 'azure-ad-sharepoint' && config.reuseAzureAdCredentials) {
      const azureAd = await prisma.oauth_configs.findUnique({ where: { provider: 'azure-ad' } })
      effectiveClientId = azureAd?.clientId ?? null
      effectiveClientSecretEncrypted = azureAd?.clientSecret ?? null
      effectiveTenantId = azureAd?.tenantId ?? null
    }

    if (!effectiveClientId || !effectiveClientSecretEncrypted) {
      const source =
        provider === 'azure-ad-sharepoint' && config.reuseAzureAdCredentials
          ? 'de la app de Microsoft OAuth que estás reutilizando'
          : `de ${label}`
      return NextResponse.json(
        {
          success: false,
          error: `La configuración ${source} está incompleta. Verifica Client ID y Client Secret.`,
        },
        { status: 400 }
      )
    }

    // Desencriptar secret para las verificaciones
    let plainSecret: string
    try {
      plainSecret = decrypt(effectiveClientSecretEncrypted)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Error al leer el Client Secret guardado. Vuelve a ingresarlo.' },
        { status: 500 }
      )
    }

    const diagnostics: string[] = []
    let secretVerified = true

    if (provider === 'azure-ad' || provider === 'azure-ad-sharepoint') {
      const tenant = effectiveTenantId || 'common'

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

      // Paso 2: verificar clientId + clientSecret — solo es fiable contra un
      // tenant específico. Con un alias multi-tenant, client_credentials no
      // es el flujo que este proveedor va a usar de verdad (login/Planner
      // usan authorization_code + refresh_token), así que no lo probamos:
      // decirlo explícitamente es mejor que dar un resultado que no
      // significa lo que el admin cree que significa.
      if (MULTI_TENANT_ALIASES.has(tenant.toLowerCase())) {
        secretVerified = false
        diagnostics.push(
          `Client Secret no verificado: con el tenant "${tenant}" Microsoft no admite comprobarlo ` +
            'sin interacción de un usuario (client_credentials no funciona con tenants multi-tenant). ' +
            'Confírmalo completando el inicio de sesión real (Conectar cuenta / probar el login).'
        )
      } else {
        const credsCheck = await verifyAzureCredentials(tenant, effectiveClientId, plainSecret)
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
    }

    if (provider === 'google') {
      const credsCheck = await verifyGoogleCredentials(effectiveClientId, plainSecret)
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

    // SharePoint es app-only (client_credentials) — no hay Redirect URI ni
    // popup de usuario que registrar en el portal, así que ese mensaje no
    // aplica. En su lugar se recuerda el paso aparte que sí es obligatorio:
    // otorgar Sites.Selected al sitio específico (no se hace desde aquí).
    if (provider === 'azure-ad-sharepoint') {
      return NextResponse.json({
        success: true,
        label,
        provider,
        diagnostics,
        redirectUri: null,
        message: `Credenciales de ${label} verificadas correctamente. Falta otorgarle a esta app el permiso Sites.Selected sobre el sitio específico de SharePoint (paso aparte, ver Ajustes → Almacenamiento).`,
      })
    }

    // Todo OK — devolver también la redirect URI para que el usuario confirme que está en el portal
    const baseUrl =
      request.headers.get('origin') || request.headers.get('referer')?.split('/admin')[0] || ''
    // 'azure-ad' es una sola credencial para varios flujos (login, Planner,
    // Microsoft To Do, y — si están activos — adjuntos/backups en OneDrive),
    // cada uno con su propio callback fijo. Solo se listan acá los dos que
    // hacen falta siempre que este provider esté activo; los de adjuntos y
    // backups se muestran en sus propias pantallas de configuración cuando
    // corresponde, para no abrumar a quien solo usa login/Planner.
    const defaultRedirectUri =
      provider === 'azure-ad'
        ? `${baseUrl}/api/auth/callback/azure-ad, ${baseUrl}/api/planner/oauth-callback`
        : `${baseUrl}/api/auth/callback/${provider}`
    const redirectUri = config.redirectUri || defaultRedirectUri

    return NextResponse.json({
      success: true,
      label,
      provider,
      diagnostics,
      redirectUri,
      message: secretVerified
        ? `Credenciales de ${label} verificadas correctamente. Asegúrate de que la(s) Redirect URI(s) estén registradas en el portal.`
        : `Tenant y Client ID de ${label} verificados. El Client Secret no se pudo comprobar por API (ver detalle abajo) — confírmalo completando el inicio de sesión real. Asegúrate de que la(s) Redirect URI(s) estén registradas en el portal.`,
    })
  } catch (error) {
    console.error('Error testing OAuth config:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno al verificar la configuración.' },
      { status: 500 }
    )
  }
}
