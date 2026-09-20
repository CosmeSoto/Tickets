'use client'

/**
 * Tarjeta de SharePoint dentro de Ajustes → Almacenamiento de adjuntos.
 *
 * Distinta de las de Google Drive/OneDrive (`ProviderCard` en
 * `attachments-storage-tab.tsx`) porque SharePoint no usa un flujo delegado
 * (usuario autoriza vía popup) sino credenciales de APLICACIÓN
 * (client_credentials + permiso Sites.Selected). Eso implica dos pasos
 * distintos, ambos en esta tarjeta:
 *  1. Credenciales de la app (Client ID/Secret/Tenant) — mismo patrón que
 *     la tarjeta de Planner en /admin/planner/settings, guardadas en
 *     `oauth_configs` bajo el provider 'azure-ad-sharepoint'.
 *  2. Sitio de SharePoint a usar — requiere que el permiso Sites.Selected
 *     ya haya sido otorgado a la app sobre ESE sitio específico, un paso
 *     manual en Microsoft 365 que esta tarjeta no puede hacer por sí sola
 *     (no hay ningún "botón mágico": Sites.Selected se otorga con un token
 *     de administrador de sitios, no con el flujo de esta app).
 */

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  Key,
  FlaskConical,
  Save,
  Info,
  Trash2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface SharePointStorageCardProps {
  enabled: boolean
  configured: boolean
  siteUrl: string | null
  saving: boolean
  onToggleEnabled: (enabled: boolean) => void
  onSiteConfigChanged: () => void
}

export function SharePointStorageCard({
  enabled,
  configured,
  siteUrl,
  saving,
  onToggleEnabled,
  onSiteConfigChanged,
}: SharePointStorageCardProps) {
  const { toast } = useToast()

  const [loadingOAuth, setLoadingOAuth] = useState(true)
  const [savingOAuth, setSavingOAuth] = useState(false)
  const [testing, setTesting] = useState(false)
  const [oauth, setOauth] = useState({
    clientId: '',
    clientSecret: '',
    tenantId: '',
    isEnabled: false,
    showSecret: false,
    hasExistingSecret: false,
  })

  const [siteUrlInput, setSiteUrlInput] = useState('')
  const [savingSite, setSavingSite] = useState(false)

  const loadOAuthConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/oauth-config')
      const data = await res.json()
      const config = data.data?.find((c: any) => c.provider === 'azure-ad-sharepoint')
      if (config) {
        setOauth(current => ({
          ...current,
          clientId: config.clientId ?? '',
          tenantId: config.tenantId ?? '',
          isEnabled: config.isEnabled,
          hasExistingSecret: Boolean(config.hasClientSecret),
        }))
      }
    } catch {
      toast({ title: 'Error cargando credenciales de SharePoint', variant: 'destructive' })
    } finally {
      setLoadingOAuth(false)
    }
  }, [toast])

  useEffect(() => {
    loadOAuthConfig()
  }, [loadOAuthConfig])

  useEffect(() => {
    setSiteUrlInput(siteUrl ?? '')
  }, [siteUrl])

  const saveOAuthConfig = async () => {
    if (!oauth.clientId || (!oauth.clientSecret && !oauth.hasExistingSecret)) {
      toast({
        title: 'Campos requeridos',
        description: 'Client ID y Client Secret son obligatorios',
        variant: 'destructive',
      })
      return
    }
    setSavingOAuth(true)
    try {
      const payload: Record<string, unknown> = {
        provider: 'azure-ad-sharepoint',
        clientId: oauth.clientId,
        tenantId: oauth.tenantId || null,
        isEnabled: oauth.isEnabled,
      }
      if (oauth.clientSecret) payload.clientSecret = oauth.clientSecret

      const res = await fetch('/api/admin/oauth-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
        return
      }
      toast({
        title: 'Credenciales guardadas',
        description: 'Configuración de SharePoint guardada',
      })
      setOauth(current => ({ ...current, clientSecret: '', hasExistingSecret: true }))
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSavingOAuth(false)
    }
  }

  const testOAuthConfig = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/admin/oauth-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'azure-ad-sharepoint' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast({
          title: 'Error en credenciales de SharePoint',
          description: data.error || 'Error al verificar la configuración.',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Credenciales verificadas', description: data.message })
    } catch {
      toast({ title: 'Error de red', variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  const saveSite = async () => {
    if (!siteUrlInput.trim()) {
      toast({ title: 'La URL del sitio es requerida', variant: 'destructive' })
      return
    }
    setSavingSite(true)
    try {
      const res = await fetch('/api/admin/attachments/sharepoint-site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: siteUrlInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: 'No se pudo conectar con ese sitio',
          description: data.error,
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Sitio conectado',
        description: 'SharePoint quedó listo para usarse como destino.',
      })
      onSiteConfigChanged()
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSavingSite(false)
    }
  }

  const removeSite = async () => {
    setSavingSite(true)
    try {
      const res = await fetch('/api/admin/attachments/sharepoint-site', { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Sitio quitado' })
        setSiteUrlInput('')
        onSiteConfigChanged()
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSavingSite(false)
    }
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <div>
          <CardTitle className='flex items-center gap-2'>
            <Cloud className='h-5 w-5' />
            SharePoint
            {configured && <CheckCircle2 className='h-4 w-4 text-green-600' />}
          </CardTitle>
          <CardDescription>
            {configured ? 'Sitio conectado' : 'Sin sitio configurado'} ·{' '}
            {enabled ? 'Habilitado' : 'Deshabilitado'}
          </CardDescription>
        </div>
        <Switch checked={enabled} disabled={saving} onCheckedChange={onToggleEnabled} />
      </CardHeader>
      <CardContent className='space-y-5'>
        <Alert>
          <Info className='h-4 w-4' />
          <AlertDescription className='text-sm space-y-1'>
            <p>
              SharePoint usa credenciales de <strong>aplicación</strong>, no un usuario que
              autoriza: no hay ventana emergente de consentimiento.
            </p>
            <p>
              Después de guardar las credenciales abajo, un administrador de Microsoft 365 debe
              otorgarle a esta app el permiso <code className='font-mono'>Sites.Selected</code>{' '}
              sobre el sitio específico — un paso aparte que se hace con PowerShell o Graph
              Explorer, fuera de esta app. Sin ese paso, la conexión del sitio (más abajo) va a
              fallar con un error 403.
            </p>
          </AlertDescription>
        </Alert>

        {/* Credenciales de aplicación */}
        <div className='space-y-3 rounded-lg border p-3'>
          <p className='text-sm font-medium'>1. Credenciales de la aplicación (Entra ID)</p>

          {loadingOAuth ? (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <RefreshCw className='h-4 w-4 animate-spin' /> Cargando…
            </div>
          ) : (
            <>
              <div className='space-y-2'>
                <Label htmlFor='sp-client-id'>Application (Client) ID *</Label>
                <Input
                  id='sp-client-id'
                  value={oauth.clientId}
                  onChange={e => setOauth(current => ({ ...current, clientId: e.target.value }))}
                  placeholder='12345678-1234-1234-1234-123456789012'
                  className='font-mono text-sm'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='sp-client-secret'>
                  Client Secret{' '}
                  {oauth.hasExistingSecret ? '(dejar vacío para mantener el actual)' : '*'}
                </Label>
                {oauth.hasExistingSecret && !oauth.clientSecret && (
                  <div className='flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border text-xs text-muted-foreground'>
                    <Key className='h-3.5 w-3.5 flex-shrink-0' />
                    Secret guardado — deja vacío para mantenerlo o escribe uno nuevo para
                    reemplazarlo
                  </div>
                )}
                <div className='relative'>
                  <Input
                    id='sp-client-secret'
                    type={oauth.showSecret ? 'text' : 'password'}
                    value={oauth.clientSecret}
                    onChange={e =>
                      setOauth(current => ({ ...current, clientSecret: e.target.value }))
                    }
                    placeholder={oauth.hasExistingSecret ? '••••••••  (sin cambios)' : '...'}
                    className='font-mono text-sm pr-10'
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='absolute right-0 top-0 h-full px-3'
                    onClick={() =>
                      setOauth(current => ({ ...current, showSecret: !current.showSecret }))
                    }
                  >
                    {oauth.showSecret ? (
                      <EyeOff className='h-4 w-4' />
                    ) : (
                      <Eye className='h-4 w-4' />
                    )}
                  </Button>
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='sp-tenant-id'>Tenant ID</Label>
                <Input
                  id='sp-tenant-id'
                  value={oauth.tenantId}
                  onChange={e => setOauth(current => ({ ...current, tenantId: e.target.value }))}
                  placeholder='ID del directorio (tenant) — no uses "common" aquí'
                  className='font-mono text-sm'
                />
              </div>

              <div className='flex items-center justify-between p-3 border rounded-lg'>
                <Label htmlFor='sp-oauth-enabled' className='text-sm cursor-pointer'>
                  Habilitar estas credenciales
                </Label>
                <Switch
                  id='sp-oauth-enabled'
                  checked={oauth.isEnabled}
                  onCheckedChange={checked =>
                    setOauth(current => ({ ...current, isEnabled: checked }))
                  }
                />
              </div>

              <div className='flex flex-col sm:flex-row gap-2'>
                <Button
                  onClick={saveOAuthConfig}
                  disabled={savingOAuth}
                  size='sm'
                  className='flex-1'
                >
                  {savingOAuth ? (
                    <RefreshCw className='mr-2 h-3.5 w-3.5 animate-spin' />
                  ) : (
                    <Save className='mr-2 h-3.5 w-3.5' />
                  )}
                  Guardar credenciales
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={testOAuthConfig}
                  disabled={testing || !oauth.isEnabled || !oauth.clientId}
                  title={
                    !oauth.isEnabled
                      ? 'Habilita las credenciales para poder probarlas'
                      : 'Verifica Client ID/Secret/Tenant contra Microsoft'
                  }
                >
                  {testing ? (
                    <RefreshCw className='mr-2 h-3.5 w-3.5 animate-spin' />
                  ) : (
                    <FlaskConical className='mr-2 h-3.5 w-3.5' />
                  )}
                  Probar credenciales
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Sitio de SharePoint */}
        <div className='space-y-3 rounded-lg border p-3'>
          <p className='text-sm font-medium'>2. Sitio de SharePoint a usar</p>
          <div className='space-y-2'>
            <Label htmlFor='sp-site-url'>URL del sitio</Label>
            <Input
              id='sp-site-url'
              value={siteUrlInput}
              onChange={e => setSiteUrlInput(e.target.value)}
              placeholder='https://tuempresa.sharepoint.com/sites/Adjuntos'
              className='font-mono text-sm'
              disabled={configured}
            />
          </div>
          <div className='flex flex-col sm:flex-row gap-2'>
            {configured ? (
              <Button variant='outline' size='sm' onClick={removeSite} disabled={savingSite}>
                <Trash2 className='mr-2 h-3.5 w-3.5' />
                Quitar sitio
              </Button>
            ) : (
              <Button size='sm' onClick={saveSite} disabled={savingSite || !siteUrlInput.trim()}>
                {savingSite ? (
                  <RefreshCw className='mr-2 h-3.5 w-3.5 animate-spin' />
                ) : (
                  <Cloud className='mr-2 h-3.5 w-3.5' />
                )}
                Conectar sitio
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
