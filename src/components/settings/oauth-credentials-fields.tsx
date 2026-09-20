'use client'

/**
 * Campos de credenciales de una app OAuth (Client ID/Secret/Tenant/Enable +
 * Guardar/Probar), reutilizados por las 3 pantallas que configuran una fila
 * de `oauth_configs`: Ajustes → OAuth (Google y Microsoft/login),
 * Configuración de Planner (azure-ad-planner) y Ajustes → Almacenamiento →
 * SharePoint (azure-ad-sharepoint). Antes de esto, cada pantalla tenía su
 * propia copia de este formulario con la misma forma exacta — este
 * componente reemplaza esas 3 copias sin cambiar el backend, que ya era
 * genérico (`/api/admin/oauth-config` + `/api/admin/oauth-config/test`).
 *
 * El encabezado/tarjeta (ícono, título, badge, descripción del propósito)
 * sigue siendo responsabilidad de cada pantalla — solo los campos y su
 * lógica de carga/guardado/prueba viven acá.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Eye, EyeOff, Key, Save, FlaskConical, Loader2, Globe, Copy, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export type OAuthCredentialsProvider =
  | 'google'
  | 'azure-ad'
  | 'azure-ad-planner'
  | 'azure-ad-sharepoint'

interface OAuthConfigApiRow {
  provider: string
  clientId: string
  hasClientSecret?: boolean
  tenantId?: string | null
  isEnabled: boolean
}

interface OAuthCredentialsFieldsProps {
  provider: OAuthCredentialsProvider
  clientIdLabel?: string
  clientIdPlaceholder: string
  clientSecretPlaceholder?: string
  showTenantId?: boolean
  tenantLabel?: string
  tenantPlaceholder?: string
  tenantHint?: React.ReactNode
  tenantRequired?: boolean
  /** Ruta del callback a registrar en el portal (ej. '/api/auth/callback/google'). Omitir para providers de aplicación (SharePoint) que no tienen redirect. */
  redirectUriPath?: string
  scopes?: string
  enabledLabel: string
  enabledDescription: string
  saveLabel?: string
  buttonSize?: 'default' | 'sm'
  /** Se llama tras cargar y tras cada cambio, para que el contenedor (ej. el badge Activo/Inactivo) se mantenga en sincronía sin duplicar el estado. */
  onStateChange?: (state: { isEnabled: boolean; clientId: string }) => void
}

export function OAuthCredentialsFields({
  provider,
  clientIdLabel = 'Client ID *',
  clientIdPlaceholder,
  clientSecretPlaceholder = '...',
  showTenantId = true,
  tenantLabel = 'Tenant ID',
  tenantPlaceholder = 'common',
  tenantHint,
  tenantRequired = false,
  redirectUriPath,
  scopes,
  enabledLabel,
  enabledDescription,
  saveLabel = 'Guardar credenciales',
  buttonSize = 'default',
  onStateChange,
}: OAuthCredentialsFieldsProps) {
  const { toast } = useToast()

  const [config, setConfig] = useState({
    clientId: '',
    clientSecret: '',
    tenantId: '',
    isEnabled: false,
    showSecret: false,
    hasExistingSecret: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/oauth-config')
      const data = await res.json()
      const existing = data.data?.find((c: OAuthConfigApiRow) => c.provider === provider)
      if (existing) {
        setConfig(current => {
          const next = {
            ...current,
            clientId: existing.clientId ?? '',
            tenantId: existing.tenantId ?? '',
            isEnabled: existing.isEnabled ?? false,
            hasExistingSecret: Boolean(existing.hasClientSecret),
          }
          onStateChange?.({ isEnabled: next.isEnabled, clientId: next.clientId })
          return next
        })
      }
    } catch {
      toast({ title: 'Error cargando credenciales', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  useEffect(() => {
    void load()
  }, [load])

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const redirectUri = redirectUriPath ? `${baseUrl}${redirectUriPath}` : null

  const setEnabled = (checked: boolean) => {
    setConfig(current => ({ ...current, isEnabled: checked }))
    onStateChange?.({ isEnabled: checked, clientId: config.clientId })
  }

  const save = async () => {
    if (!config.clientId || (!config.clientSecret && !config.hasExistingSecret)) {
      toast({
        title: 'Campos requeridos',
        description: 'Client ID y Client Secret son obligatorios',
        variant: 'destructive',
      })
      return
    }
    if (showTenantId && tenantRequired && !config.tenantId) {
      toast({
        title: 'Tenant ID requerido',
        description: 'Este proveedor no admite el valor "common" — indica el ID del directorio.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        provider,
        clientId: config.clientId,
        tenantId: config.tenantId || null,
        isEnabled: config.isEnabled,
        redirectUri: redirectUri || undefined,
        scopes: scopes || undefined,
      }
      if (config.clientSecret) payload.clientSecret = config.clientSecret

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
      toast({ title: 'Credenciales guardadas' })
      setConfig(current => ({ ...current, clientSecret: '', hasExistingSecret: true }))
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/admin/oauth-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast({
          title: 'Error de verificación',
          description: data.error || 'Error al verificar la configuración.',
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Credenciales verificadas',
        description: data.redirectUri
          ? `${data.message} Redirect URI a confirmar en el portal: ${data.redirectUri}`
          : data.message,
      })
    } catch {
      toast({ title: 'Error de red', variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    try {
      document.execCommand('copy')
    } catch {
      /* ignorar */
    }
    document.body.removeChild(el)
  }

  const copyRedirectUri = () => {
    if (!redirectUri) return
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(redirectUri).catch(() => fallbackCopy(redirectUri))
    } else {
      fallbackCopy(redirectUri)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <Loader2 className='h-4 w-4 animate-spin' /> Cargando…
      </div>
    )
  }

  return (
    <>
      {redirectUri && (
        <div className='space-y-2'>
          <Label className='flex items-center space-x-2'>
            <Globe className='h-4 w-4' />
            <span>Redirect URI (copiar al portal)</span>
          </Label>
          <div className='flex space-x-2'>
            <Input value={redirectUri} readOnly className='font-mono text-sm' />
            <Button type='button' variant='outline' size='sm' onClick={copyRedirectUri}>
              {copied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
            </Button>
          </div>
        </div>
      )}

      <div className='space-y-2'>
        <Label htmlFor={`${provider}-client-id`}>{clientIdLabel}</Label>
        <Input
          id={`${provider}-client-id`}
          value={config.clientId}
          onChange={e => setConfig(current => ({ ...current, clientId: e.target.value }))}
          placeholder={clientIdPlaceholder}
          className='font-mono text-sm'
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor={`${provider}-client-secret`}>
          Client Secret {config.hasExistingSecret ? '(dejar vacío para mantener el actual)' : '*'}
        </Label>
        {config.hasExistingSecret && !config.clientSecret && (
          <div className='flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground'>
            <Key className='h-3.5 w-3.5 shrink-0' />
            Secret guardado — deja vacío para mantenerlo o escribe uno nuevo para reemplazarlo
          </div>
        )}
        <div className='relative'>
          <Input
            id={`${provider}-client-secret`}
            type={config.showSecret ? 'text' : 'password'}
            value={config.clientSecret}
            onChange={e => setConfig(current => ({ ...current, clientSecret: e.target.value }))}
            placeholder={
              config.hasExistingSecret ? '••••••••  (sin cambios)' : clientSecretPlaceholder
            }
            className='pr-10 font-mono text-sm'
          />
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='absolute right-0 top-0 h-full px-3'
            onClick={() => setConfig(current => ({ ...current, showSecret: !current.showSecret }))}
          >
            {config.showSecret ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
          </Button>
        </div>
      </div>

      {showTenantId && (
        <div className='space-y-2'>
          <Label htmlFor={`${provider}-tenant-id`}>
            {tenantLabel} {tenantRequired ? '*' : '(opcional)'}
          </Label>
          <Input
            id={`${provider}-tenant-id`}
            value={config.tenantId}
            onChange={e => setConfig(current => ({ ...current, tenantId: e.target.value }))}
            placeholder={tenantPlaceholder}
            className='font-mono text-sm'
          />
          {tenantHint}
        </div>
      )}

      <div className='flex items-center justify-between rounded-lg border p-4'>
        <div>
          <p className='font-medium'>{enabledLabel}</p>
          <p className='text-sm text-muted-foreground'>{enabledDescription}</p>
        </div>
        <Switch checked={config.isEnabled} onCheckedChange={setEnabled} />
      </div>

      <div className='flex flex-col gap-2 sm:flex-row'>
        <Button onClick={() => void save()} disabled={saving} size={buttonSize} className='flex-1'>
          {saving ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Save className='mr-2 h-4 w-4' />
          )}
          {saveLabel}
        </Button>
        <Button
          variant='outline'
          size={buttonSize}
          onClick={() => void test()}
          disabled={testing || !config.isEnabled || !config.clientId}
          title={
            !config.isEnabled
              ? 'Habilita las credenciales para poder probarlas'
              : 'Verifica las credenciales contra el proveedor'
          }
        >
          {testing ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <FlaskConical className='mr-2 h-4 w-4' />
          )}
          Probar conexión
        </Button>
      </div>
    </>
  )
}

export interface OAuthCredentialsStatus {
  configured: boolean
  isEnabled: boolean
}

interface OAuthCredentialsStatusLinkProps {
  provider: OAuthCredentialsProvider
  onStatus?: (status: OAuthCredentialsStatus) => void
}

/**
 * Reemplaza un formulario de credenciales embebido en una pantalla de
 * funcionalidad (Planner, SharePoint) por una referencia de solo lectura a
 * donde esas credenciales realmente se configuran: Ajustes → OAuth. Antes,
 * cada pantalla tenía su propia copia editable de las mismas credenciales —
 * duplicando no solo código sino el LUGAR de la configuración, lo que
 * permitía guardar valores distintos en cada copia sin que ninguna avisara.
 */
export function OAuthCredentialsStatusLink({
  provider,
  onStatus,
}: OAuthCredentialsStatusLinkProps) {
  const [status, setStatus] = useState<OAuthCredentialsStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/oauth-config')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        const existing = data.data?.find((c: OAuthConfigApiRow) => c.provider === provider)
        const next = {
          configured: Boolean(existing?.clientId && existing?.hasClientSecret),
          isEnabled: Boolean(existing?.isEnabled),
        }
        setStatus(next)
        onStatus?.(next)
      })
      .catch(() => {
        const next = { configured: false, isEnabled: false }
        setStatus(next)
        onStatus?.(next)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  const label = !status
    ? 'Verificando…'
    : status.isEnabled
      ? 'Configuradas y habilitadas'
      : status.configured
        ? 'Configuradas, pero deshabilitadas'
        : 'Sin configurar'

  return (
    <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
      <div>
        <p className='text-sm font-medium'>Credenciales de la aplicación (Entra ID)</p>
        <p className='text-xs text-muted-foreground'>{label}</p>
      </div>
      <Button variant='outline' size='sm' asChild>
        <Link href='/admin/settings?tab=oauth'>Ir a Ajustes → OAuth</Link>
      </Button>
    </div>
  )
}
