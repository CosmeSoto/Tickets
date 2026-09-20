'use client'

/**
 * Tarjeta de SharePoint dentro de Ajustes → Almacenamiento de adjuntos.
 *
 * Distinta de las de Google Drive/OneDrive (`ProviderCard` en
 * `attachments-storage-tab.tsx`) porque SharePoint no usa un flujo delegado
 * (usuario autoriza vía popup) sino credenciales de APLICACIÓN
 * (client_credentials + permiso Sites.Selected). Aun así, sigue el mismo
 * principio que Google Drive/OneDrive: las credenciales de la app se
 * configuran una sola vez en Ajustes → OAuth (no acá) — esta tarjeta solo
 * muestra su estado y resuelve el paso propio de SharePoint: el sitio a
 * usar, que requiere que el permiso Sites.Selected ya haya sido otorgado a
 * la app sobre ESE sitio específico, un paso manual en Microsoft 365 que
 * esta tarjeta no puede hacer por sí sola (no hay ningún "botón mágico":
 * Sites.Selected se otorga con un token de administrador de sitios, no con
 * el flujo de esta app).
 */

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Cloud, CheckCircle2, RefreshCw, Info, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { OAuthCredentialsStatusLink } from '@/components/settings/oauth-credentials-fields'

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

  const [credentialsEnabled, setCredentialsEnabled] = useState(false)
  const [siteUrlInput, setSiteUrlInput] = useState(siteUrl ?? '')
  const [savingSite, setSavingSite] = useState(false)

  useEffect(() => {
    setSiteUrlInput(siteUrl ?? '')
  }, [siteUrl])

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
          <AlertDescription className='text-sm'>
            SharePoint usa credenciales de <strong>aplicación</strong>, no un usuario que autoriza —
            se configuran una sola vez en Ajustes → OAuth (no acá). Después de guardarlas, un
            administrador de Microsoft 365 debe otorgarle a esa app el permiso{' '}
            <code className='font-mono'>Sites.Selected</code> con rol{' '}
            <code className='font-mono'>write</code> (no solo lectura) sobre el sitio específico —
            un paso aparte que se hace con PowerShell o Graph Explorer. Con solo lectura, conectar
            el sitio funciona pero subir un archivo real va a fallar con otro error 403.
          </AlertDescription>
        </Alert>

        {/* Credenciales de aplicación */}
        <div className='space-y-3 rounded-lg border p-3'>
          <p className='text-sm font-medium'>1. Credenciales de la aplicación (Entra ID)</p>
          <OAuthCredentialsStatusLink
            provider='azure-ad-sharepoint'
            onStatus={status => setCredentialsEnabled(status.isEnabled)}
          />
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
              disabled={configured || !credentialsEnabled}
            />
            {!configured && !credentialsEnabled && (
              <p className='text-xs text-muted-foreground'>
                Habilita las credenciales arriba (en Ajustes → OAuth) antes de conectar un sitio.
              </p>
            )}
          </div>
          <div className='flex flex-col sm:flex-row gap-2'>
            {configured ? (
              <Button variant='outline' size='sm' onClick={removeSite} disabled={savingSite}>
                <Trash2 className='mr-2 h-3.5 w-3.5' />
                Quitar sitio
              </Button>
            ) : (
              <Button
                size='sm'
                onClick={saveSite}
                disabled={savingSite || !siteUrlInput.trim() || !credentialsEnabled}
              >
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
