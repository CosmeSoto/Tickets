import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, invalidateOAuthProvidersCache } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import prisma from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { randomUUID } from 'crypto'

// GET - Obtener configuraciones OAuth
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const check = await requireSuperAdmin(session)
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: check.status })
    }

    const configs = await prisma.oauth_configs.findMany({
      orderBy: { provider: 'asc' },
    })

    // Si no hay configuraciones, retornar array vacío
    if (!configs || configs.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // Desencriptar client secrets para mostrar (parcialmente)
    const configsWithMaskedSecrets = configs.map(config => ({
      id: config.id,
      provider: config.provider,
      clientId: config.clientId,
      clientSecret: '',
      hasClientSecret: Boolean(config.clientSecret),
      tenantId: config.tenantId,
      isEnabled: config.isEnabled,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      reuseAzureAdCredentials: config.reuseAzureAdCredentials,
      updatedAt: config.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      data: configsWithMaskedSecrets,
    })
  } catch (error) {
    console.error('Error fetching OAuth configs:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      encryptionKeySet: !!process.env.ENCRYPTION_KEY,
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
    const check = await requireSuperAdmin(session)
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: check.status })
    }

    const body = await request.json()
    const {
      provider,
      clientId,
      clientSecret,
      tenantId,
      isEnabled,
      redirectUri,
      scopes,
      reuseAzureAdCredentials,
    } = body

    if (!provider) {
      return NextResponse.json({ success: false, error: 'Provider es requerido' }, { status: 400 })
    }

    if (!['google', 'azure-ad', 'azure-ad-sharepoint'].includes(provider)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provider inválido. Debe ser "google", "azure-ad" o "azure-ad-sharepoint"',
        },
        { status: 400 }
      )
    }

    // Solo tiene sentido en la fila de aplicación de SharePoint — evita una
    // fila inconsistente (p. ej. 'google' apuntando a reusar credenciales
    // ajenas sin que ningún flujo de este provider lo contemple).
    if (reuseAzureAdCredentials && provider !== 'azure-ad-sharepoint') {
      return NextResponse.json(
        { success: false, error: 'reuseAzureAdCredentials solo aplica a "azure-ad-sharepoint"' },
        { status: 400 }
      )
    }
    const reuse = provider === 'azure-ad-sharepoint' && Boolean(reuseAzureAdCredentials)

    // Con reuse activo, Client ID/Secret no los tipea el admin acá — se
    // resuelven en vivo desde 'azure-ad' (ver oauth-config.ts) — así que
    // ninguna de las validaciones de "campo requerido" de abajo aplica.
    if (!reuse && !clientId) {
      return NextResponse.json(
        { success: false, error: 'Provider y clientId son requeridos' },
        { status: 400 }
      )
    }

    // Buscar configuración existente
    const existingConfig = await prisma.oauth_configs.findUnique({
      where: { provider },
    })

    if (!reuse) {
      // Si es una nueva configuración, clientSecret es obligatorio
      if (!existingConfig && !clientSecret) {
        return NextResponse.json(
          { success: false, error: 'Client Secret es requerido para nueva configuración' },
          { status: 400 }
        )
      }

      if (isEnabled && (!clientId || (!clientSecret && !existingConfig?.clientSecret))) {
        return NextResponse.json(
          {
            success: false,
            error: 'No puedes activar OAuth sin Client ID y Client Secret configurados',
          },
          { status: 400 }
        )
      }
    } else if (isEnabled) {
      // Con reuse activo, la fuente real de las credenciales es 'azure-ad' —
      // si esa fila no tiene Client ID/Secret todavía, activar SharePoint acá
      // fallaría en silencio recién al intentar subir un archivo.
      const azureAd = await prisma.oauth_configs.findUnique({ where: { provider: 'azure-ad' } })
      if (!azureAd?.clientId || !azureAd?.clientSecret) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Para reusar la app de Microsoft OAuth, primero configúrala y guárdala en la tarjeta de arriba (con Client ID y Client Secret).',
          },
          { status: 400 }
        )
      }
    }

    // 'azure-ad-sharepoint' usa client_credentials, que Microsoft no admite
    // contra los alias multi-tenant "common"/"organizations"/"consumers" (a
    // diferencia de los otros tres providers, delegados) — sin un Tenant ID
    // real, cada subida fallaría con un error de Microsoft mucho más
    // críptico que decirlo aquí al guardar. Se valida el valor, no solo que
    // no esté vacío: escribir "common" por costumbre (es el valor sugerido
    // para los demás providers) pasaría la comprobación de "no vacío" pero
    // fallaría igual al usarlo de verdad. Aplica igual si se reusa la app de
    // Microsoft OAuth — el Tenant ID sigue siendo el propio de esta fila.
    if (provider === 'azure-ad-sharepoint' && isEnabled) {
      const effectiveTenant = (tenantId || existingConfig?.tenantId || '').trim().toLowerCase()
      if (!effectiveTenant || ['common', 'organizations', 'consumers'].includes(effectiveTenant)) {
        return NextResponse.json(
          {
            success: false,
            error:
              'SharePoint requiere el Tenant ID real del directorio — no se puede usar "common", "organizations" ni "consumers"',
          },
          { status: 400 }
        )
      }
    }

    // Preparar datos de actualización
    const updateData: any = {
      tenantId: tenantId || null,
      isEnabled: isEnabled ?? false,
      redirectUri: redirectUri || null,
      scopes: scopes || null,
      reuseAzureAdCredentials: reuse,
      updatedAt: new Date(),
    }

    // Con reuse activo, deliberadamente NO se tocan clientId/clientSecret acá
    // — se dejan como estén (si antes hubo una app dedicada, reaparece intacta
    // al desactivar el reuse más adelante, sin volver a tipearla).
    if (!reuse) {
      updateData.clientId = clientId
      // Solo encriptar si se proporcionó un secret nuevo — encrypt(undefined) lanza.
      if (clientSecret) {
        updateData.clientSecret = encrypt(clientSecret)
      }
    }

    // Create/update explícitos en vez de upsert: Prisma valida los tipos de
    // AMBOS objetos (create/update) de un upsert antes de decidir cuál usar,
    // así que un `create.clientSecret` opcional (undefined cuando no se
    // reenvía) fallaba con PrismaClientValidationError incluso en una
    // actualización que nunca iba a tocar esa rama. Antes esto rompía con 500
    // cualquier actualización que no reenviara el secret (p. ej. solo
    // activar/desactivar).
    const config = existingConfig
      ? await prisma.oauth_configs.update({ where: { provider }, data: updateData })
      : await prisma.oauth_configs.create({
          data: {
            id: randomUUID(),
            provider,
            clientId: reuse ? null : clientId,
            clientSecret: reuse ? null : encrypt(clientSecret!), // Sabemos que existe porque lo validamos arriba
            tenantId: tenantId || null,
            isEnabled: isEnabled ?? false,
            redirectUri: redirectUri || null,
            scopes: scopes || null,
            reuseAzureAdCredentials: reuse,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })

    // Auditoría
    try {
      const { AuditServiceComplete, AuditActionsComplete } =
        await import('@/lib/services/audit-service-complete')
      await AuditServiceComplete.log({
        action: existingConfig
          ? AuditActionsComplete.OAUTH_CONFIG_UPDATED
          : AuditActionsComplete.OAUTH_CONFIG_UPDATED,
        entityType: 'settings',
        entityId: config.id,
        userId: session!.user.id,
        details: {
          provider,
          isEnabled: isEnabled ?? false,
          reuseAzureAdCredentials: reuse,
          action: existingConfig ? 'updated' : 'created',
          clientIdChanged: existingConfig ? existingConfig.clientId !== clientId : true,
          secretChanged: !!clientSecret,
        },
      })
    } catch {
      /* no interrumpir */
    }

    invalidateOAuthProvidersCache()

    return NextResponse.json({
      success: true,
      message: `Configuración de ${provider} guardada exitosamente`,
      data: {
        id: config.id,
        provider: config.provider,
        isEnabled: config.isEnabled,
      },
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
    const check = await requireSuperAdmin(session)
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: check.status })
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
      data: { isEnabled },
    })

    // Auditoría
    try {
      const { AuditServiceComplete, AuditActionsComplete } =
        await import('@/lib/services/audit-service-complete')
      await AuditServiceComplete.log({
        action: AuditActionsComplete.OAUTH_CONFIG_UPDATED,
        entityType: 'settings',
        entityId: config.id,
        userId: session!.user.id,
        details: { provider, isEnabled, action: 'toggle' },
      })
    } catch {
      /* no interrumpir */
    }

    invalidateOAuthProvidersCache()

    return NextResponse.json({
      success: true,
      message: `Proveedor ${provider} ${isEnabled ? 'activado' : 'desactivado'}`,
      data: {
        provider: config.provider,
        isEnabled: config.isEnabled,
      },
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
    const check = await requireSuperAdmin(session)
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: check.status })
    }

    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider')

    if (!provider) {
      return NextResponse.json({ success: false, error: 'Provider es requerido' }, { status: 400 })
    }

    await prisma.oauth_configs.delete({
      where: { provider },
    })

    // Auditoría
    try {
      const { AuditServiceComplete, AuditActionsComplete } =
        await import('@/lib/services/audit-service-complete')
      await AuditServiceComplete.log({
        action: AuditActionsComplete.OAUTH_CONFIG_UPDATED,
        entityType: 'settings',
        entityId: provider,
        userId: session!.user.id,
        details: { provider, action: 'deleted' },
      })
    } catch {
      /* no interrumpir */
    }

    invalidateOAuthProvidersCache()

    return NextResponse.json({
      success: true,
      message: `Configuración de ${provider} eliminada`,
    })
  } catch (error) {
    console.error('Error deleting OAuth config:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar configuración' },
      { status: 500 }
    )
  }
}
