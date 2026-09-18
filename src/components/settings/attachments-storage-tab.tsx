'use client'

/**
 * Pestaña Ajustes → Almacenamiento de adjuntos.
 *
 * Mismo patrón de autorización OAuth que `backup-configuration.tsx`
 * (popup de consentimiento + polling manual del estado), pero con dos
 * conceptos separados por diseño (ver plan): un interruptor "habilitado" por
 * proveedor (independiente de la autorización) y un único "destino activo"
 * entre los proveedores habilitados + autorizados. Revocar la autorización
 * no borra el interruptor de otro proveedor, y desactivar un proveedor no
 * revoca su autorización — así se puede tener Google Drive y OneDrive
 * autorizados a la vez y cambiar cuál está activo sin re-autorizar nada.
 */

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Cloud, HardDrive, CheckCircle2, RefreshCw, Lock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type ProviderId = 'local' | 'google-drive' | 'onedrive'

interface StorageSettings {
  activeProvider: ProviderId | 'sharepoint'
  googleDrive: { enabled: boolean; authorized: boolean }
  oneDrive: { enabled: boolean; authorized: boolean }
  sharePoint: { enabled: boolean; available: boolean }
}

const PROVIDER_LABEL: Record<'google-drive' | 'onedrive', string> = {
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
}

export function AttachmentsStorageTab() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<StorageSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/attachments/storage-settings')
      if (!res.ok) throw new Error()
      setSettings(await res.json())
    } catch {
      toast({ title: 'Error cargando la configuración', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/attachments/storage-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
        return
      }
      setSettings(data)
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const authorize = async (provider: 'google-drive' | 'onedrive') => {
    try {
      const res = await fetch(`/api/admin/attachments/cloud-auth?provider=${provider}`)
      const data = await res.json()

      if (data.error) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
        return
      }
      if (data.authorized) {
        toast({
          title: 'Ya autorizado',
          description: `${PROVIDER_LABEL[provider]} ya está conectado.`,
        })
        await load()
        return
      }
      if (!data.authUrl) {
        toast({
          title: 'OAuth no configurado',
          description: `Configura y habilita ${provider === 'google-drive' ? 'Google' : 'Microsoft (Azure AD)'} en Ajustes → OAuth antes de conectar ${PROVIDER_LABEL[provider]}.`,
          variant: 'destructive',
        })
        return
      }

      window.open(data.authUrl, '_blank', 'width=600,height=700,scrollbars=yes')
      toast({
        title: 'Autorización iniciada',
        description:
          'Completa la autorización en la ventana que se abrió y luego recarga esta página.',
      })
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    }
  }

  const revoke = async (provider: 'google-drive' | 'onedrive') => {
    try {
      const res = await fetch(`/api/admin/attachments/cloud-auth?provider=${provider}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast({
          title: 'Acceso revocado',
          description: `${PROVIDER_LABEL[provider]} desconectado.`,
        })
        await load()
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    }
  }

  if (loading || !settings) {
    return (
      <div className='flex items-center justify-center py-16 text-muted-foreground'>
        <RefreshCw className='h-5 w-5 animate-spin mr-2' /> Cargando…
      </div>
    )
  }

  const eligibleForActive: ProviderId[] = ['local']
  if (settings.googleDrive.enabled && settings.googleDrive.authorized)
    eligibleForActive.push('google-drive')
  if (settings.oneDrive.enabled && settings.oneDrive.authorized) eligibleForActive.push('onedrive')

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Destino de archivos nuevos</CardTitle>
          <CardDescription>
            Dónde se guardan los adjuntos que se suban de aquí en adelante. Los que ya existen no se
            mueven — siguen sirviéndose desde donde están.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.activeProvider === 'sharepoint' ? 'local' : settings.activeProvider}
            onValueChange={value => patch({ activeProvider: value })}
            disabled={saving}
          >
            {eligibleForActive.map(provider => (
              <div key={provider} className='flex items-center gap-2 py-1'>
                <RadioGroupItem value={provider} id={`active-${provider}`} />
                <Label htmlFor={`active-${provider}`} className='cursor-pointer'>
                  {provider === 'local' ? 'Disco local (por defecto)' : PROVIDER_LABEL[provider]}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {eligibleForActive.length === 1 && (
            <p className='text-sm text-muted-foreground mt-2'>
              Habilita y autoriza Google Drive u OneDrive abajo para poder elegirlos como destino.
            </p>
          )}
        </CardContent>
      </Card>

      <ProviderCard
        icon={<Cloud className='h-5 w-5' />}
        title='Google Drive'
        enabled={settings.googleDrive.enabled}
        authorized={settings.googleDrive.authorized}
        saving={saving}
        onToggle={enabled => patch({ googleDriveEnabled: enabled })}
        onAuthorize={() => authorize('google-drive')}
        onRevoke={() => revoke('google-drive')}
      />

      <ProviderCard
        icon={<Cloud className='h-5 w-5' />}
        title='OneDrive'
        enabled={settings.oneDrive.enabled}
        authorized={settings.oneDrive.authorized}
        saving={saving}
        onToggle={enabled => patch({ oneDriveEnabled: enabled })}
        onAuthorize={() => authorize('onedrive')}
        onRevoke={() => revoke('onedrive')}
      />

      <Card className='opacity-60'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Lock className='h-4 w-4' /> SharePoint
          </CardTitle>
          <CardDescription>
            Próximamente — requiere permisos de aplicación (Sites.Selected) configurados en Azure
            por sitio.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

function ProviderCard({
  icon,
  title,
  enabled,
  authorized,
  saving,
  onToggle,
  onAuthorize,
  onRevoke,
}: {
  icon: React.ReactNode
  title: string
  enabled: boolean
  authorized: boolean
  saving: boolean
  onToggle: (enabled: boolean) => void
  onAuthorize: () => void
  onRevoke: () => void
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <div>
          <CardTitle className='flex items-center gap-2'>
            {icon}
            {title}
            {authorized && <CheckCircle2 className='h-4 w-4 text-green-600' />}
          </CardTitle>
          <CardDescription>
            {authorized ? 'Autorizado' : 'Sin autorizar'} ·{' '}
            {enabled ? 'Habilitado' : 'Deshabilitado'}
          </CardDescription>
        </div>
        <Switch checked={enabled} disabled={saving} onCheckedChange={onToggle} />
      </CardHeader>
      <CardContent>
        {authorized ? (
          <Button variant='outline' size='sm' onClick={onRevoke}>
            <HardDrive className='h-4 w-4 mr-2' /> Revocar acceso
          </Button>
        ) : (
          <Button variant='outline' size='sm' onClick={onAuthorize}>
            <Cloud className='h-4 w-4 mr-2' /> Autorizar acceso
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
