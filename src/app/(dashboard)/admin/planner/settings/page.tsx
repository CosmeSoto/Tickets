'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Save,
  CheckCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Key,
  FlaskConical,
  Loader2,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

type OAuthFormState = {
  clientId: string
  clientSecret: string
  tenantId: string
  isEnabled: boolean
  hasExistingSecret: boolean
  showSecret: boolean
}

const initialOAuthConfig: OAuthFormState = {
  clientId: '',
  clientSecret: '',
  tenantId: '',
  isEnabled: false,
  hasExistingSecret: false,
  showSecret: false,
}

type PlannerSettings = {
  enabled: boolean
  groupId: string
  planId: string
  syncDirection: 'outbound' | 'bidirectional'
}

const initialSettings: PlannerSettings = {
  enabled: false,
  groupId: '',
  planId: '',
  syncDirection: 'outbound',
}

interface SyncLink {
  id: string
  taskId: string
  taskTitle: string
  syncStatus: string
  syncError: string | null
  lastSyncedAt: string | null
}

export default function PlannerSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [settings, setSettings] = useState(initialSettings)
  const [canWrite, setCanWrite] = useState(false)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authorizing, setAuthorizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<{ id: string; displayName: string }[]>([])
  const [plans, setPlans] = useState<{ id: string; title: string }[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(false)

  const [links, setLinks] = useState<SyncLink[]>([])

  const [oauthConfig, setOauthConfig] = useState<OAuthFormState>(initialOAuthConfig)
  const [savingOAuth, setSavingOAuth] = useState(false)
  const [testingOAuth, setTestingOAuth] = useState(false)

  const loadOAuthConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/oauth-config')
      const data = await res.json()
      const existing = data.data?.find((c: any) => c.provider === 'azure-ad-planner')
      if (existing) {
        setOauthConfig(current => ({
          ...current,
          clientId: existing.clientId ?? '',
          tenantId: existing.tenantId ?? '',
          isEnabled: existing.isEnabled ?? false,
          hasExistingSecret: Boolean(existing.hasClientSecret),
        }))
      }
    } catch {
      // silencioso — no crítico
    }
  }, [])

  const saveOAuthConfig = async () => {
    if (!oauthConfig.clientId || (!oauthConfig.clientSecret && !oauthConfig.hasExistingSecret)) {
      toast({
        title: 'Faltan datos',
        description: 'Client ID y Client Secret son obligatorios.',
        variant: 'destructive',
      })
      return
    }
    setSavingOAuth(true)
    try {
      const res = await fetch('/api/admin/oauth-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'azure-ad-planner',
          clientId: oauthConfig.clientId,
          clientSecret: oauthConfig.clientSecret || undefined,
          tenantId: oauthConfig.tenantId || null,
          isEnabled: oauthConfig.isEnabled,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No fue posible guardar.')
      toast({ title: 'Credenciales guardadas' })
      setOauthConfig(current => ({ ...current, clientSecret: '', hasExistingSecret: true }))
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No fue posible guardar.',
        variant: 'destructive',
      })
    } finally {
      setSavingOAuth(false)
    }
  }

  const testOAuthConfig = async () => {
    setTestingOAuth(true)
    try {
      const res = await fetch('/api/admin/oauth-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'azure-ad-planner' }),
      })
      const data = await res.json()
      toast({
        title: data.success ? 'Conexión verificada' : 'Error de verificación',
        description: data.message || data.error,
        variant: data.success ? undefined : 'destructive',
      })
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setTestingOAuth(false)
    }
  }

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/planner/settings')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No fue posible cargar la configuración.')
      setSettings({ ...initialSettings, ...data.settings })
      setConnected(data.connected === true)
      setCanWrite(data.canWrite === true)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error de configuración.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSyncStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/planner/sync-status')
      if (!response.ok) return
      const data = await response.json()
      setLinks(data.links ?? [])
    } catch {
      // silencioso — no crítico para la pantalla
    }
  }, [])

  useEffect(() => {
    void load()
    void loadSyncStatus()
    void loadOAuthConfig()
  }, [load, loadSyncStatus, loadOAuthConfig])

  // El callback de OAuth redirige de vuelta acá con ?cloud=authorized|error
  useEffect(() => {
    const cloud = searchParams.get('cloud')
    if (!cloud) return
    if (cloud === 'authorized') {
      toast({
        title: 'Cuenta de Microsoft conectada',
        description: 'Planner ya puede sincronizar.',
      })
      void load()
    } else if (cloud === 'error') {
      const reason = searchParams.get('reason')
      toast({
        title: 'No se pudo conectar',
        description: reason ? decodeURIComponent(reason) : 'Error desconocido',
        variant: 'destructive',
      })
    }
    router.replace('/admin/planner/settings')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (!connected) {
      setGroups([])
      return
    }
    setLoadingGroups(true)
    fetch('/api/admin/planner/groups')
      .then(res => res.json())
      .then(data => setGroups(data.groups ?? []))
      .catch(() => {})
      .finally(() => setLoadingGroups(false))
  }, [connected])

  useEffect(() => {
    if (!connected || !settings.groupId) {
      setPlans([])
      return
    }
    setLoadingPlans(true)
    fetch(`/api/admin/planner/plans?groupId=${settings.groupId}`)
      .then(res => res.json())
      .then(data => setPlans(data.plans ?? []))
      .catch(() => {})
      .finally(() => setLoadingPlans(false))
  }, [connected, settings.groupId])

  const authorize = async () => {
    setAuthorizing(true)
    try {
      const res = await fetch('/api/admin/planner/cloud-auth')
      const data = await res.json()
      if (data.error) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
        return
      }
      if (data.oauthConfigured === false || !data.authUrl) {
        toast({
          title: 'OAuth no configurado',
          description:
            'Configura y habilita "azure-ad-planner" en Configuración del sistema → OAuth antes de conectar la cuenta dedicada.',
          variant: 'destructive',
        })
        return
      }
      window.open(data.authUrl, '_blank', 'width=600,height=700,scrollbars=yes')
      toast({
        title: 'Autorización iniciada',
        description:
          'Completa el inicio de sesión en la ventana que se abrió con la cuenta dedicada de Microsoft 365.',
      })
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setAuthorizing(false)
    }
  }

  const revoke = async () => {
    try {
      const res = await fetch('/api/admin/planner/cloud-auth', { method: 'DELETE' })
      if (res.ok) {
        setConnected(false)
        toast({ title: 'Conexión revocada' })
      }
    } catch {
      toast({ title: 'Error al revocar acceso', variant: 'destructive' })
    }
  }

  const save = async () => {
    if (!canWrite) return
    try {
      setSaving(true)
      const response = await fetch('/api/admin/planner/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: settings.enabled,
          groupId: settings.groupId,
          planId: settings.planId,
          syncDirection: settings.syncDirection,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No fue posible guardar.')
      setSettings(data.settings)
      toast({ title: 'Configuración guardada' })
    } catch (saveError) {
      toast({
        title: 'Error',
        description: saveError instanceof Error ? saveError.message : 'No fue posible guardar.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModuleLayout
      title='Configuración de Tareas / Planner'
      subtitle='Conexión con Microsoft 365 y destino de sincronización de tareas.'
      loading={loading}
      error={error}
      onRetry={load}
      headerActions={
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => router.push('/planner')}>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Volver
          </Button>
          {canWrite && (
            <Button size='sm' disabled={saving} onClick={() => void save()}>
              <Save className='mr-2 h-4 w-4' />
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </div>
      }
    >
      <div className='space-y-6 max-w-2xl'>
        <Card>
          <CardHeader>
            <CardTitle>Credenciales de la aplicación (Azure AD)</CardTitle>
            <CardDescription>
              Registro de aplicación en Entra ID con permisos delegados de Planner (Tasks.ReadWrite,
              Group.Read.All). Puede ser el mismo registro que ya usa el login de Microsoft, solo
              con estos permisos agregados.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='planner-client-id'>Client ID *</Label>
              <Input
                id='planner-client-id'
                value={oauthConfig.clientId}
                disabled={!canWrite}
                onChange={e =>
                  setOauthConfig(current => ({ ...current, clientId: e.target.value }))
                }
                placeholder='00000000-0000-0000-0000-000000000000'
                className='font-mono text-sm'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='planner-client-secret'>
                Client Secret{' '}
                {oauthConfig.hasExistingSecret ? '(dejar vacío para mantener el actual)' : '*'}
              </Label>
              {oauthConfig.hasExistingSecret && !oauthConfig.clientSecret && (
                <div className='flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground'>
                  <Key className='h-3.5 w-3.5 shrink-0' />
                  Secret guardado — deja vacío para mantenerlo o escribe uno nuevo para reemplazarlo
                </div>
              )}
              <div className='relative'>
                <Input
                  id='planner-client-secret'
                  type={oauthConfig.showSecret ? 'text' : 'password'}
                  value={oauthConfig.clientSecret}
                  disabled={!canWrite}
                  onChange={e =>
                    setOauthConfig(current => ({ ...current, clientSecret: e.target.value }))
                  }
                  placeholder={oauthConfig.hasExistingSecret ? '••••••••  (sin cambios)' : ''}
                  className='pr-10 font-mono text-sm'
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='absolute right-0 top-0 h-full px-3'
                  onClick={() =>
                    setOauthConfig(current => ({ ...current, showSecret: !current.showSecret }))
                  }
                >
                  {oauthConfig.showSecret ? (
                    <EyeOff className='h-4 w-4' />
                  ) : (
                    <Eye className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='planner-tenant-id'>Tenant ID (opcional)</Label>
              <Input
                id='planner-tenant-id'
                value={oauthConfig.tenantId}
                disabled={!canWrite}
                onChange={e =>
                  setOauthConfig(current => ({ ...current, tenantId: e.target.value }))
                }
                placeholder='common'
                className='font-mono text-sm'
              />
            </div>
            <div className='flex items-center justify-between rounded-lg border p-4'>
              <div>
                <p className='font-medium'>Habilitar credenciales</p>
                <p className='text-sm text-muted-foreground'>
                  Debe estar activo para poder conectar la cuenta más abajo.
                </p>
              </div>
              <Switch
                checked={oauthConfig.isEnabled}
                disabled={!canWrite}
                onCheckedChange={checked =>
                  setOauthConfig(current => ({ ...current, isEnabled: checked }))
                }
              />
            </div>
            {canWrite && (
              <div className='flex flex-col gap-2 sm:flex-row'>
                <Button
                  onClick={() => void saveOAuthConfig()}
                  disabled={savingOAuth}
                  className='flex-1'
                >
                  {savingOAuth ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Save className='mr-2 h-4 w-4' />
                  )}
                  Guardar credenciales
                </Button>
                <Button
                  variant='outline'
                  onClick={() => void testOAuthConfig()}
                  disabled={testingOAuth || !oauthConfig.isEnabled || !oauthConfig.clientId}
                >
                  {testingOAuth ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <FlaskConical className='mr-2 h-4 w-4' />
                  )}
                  Probar conexión
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cuenta de Microsoft 365</CardTitle>
            <CardDescription>
              Usa la cuenta dedicada de Microsoft 365 (recomendado, no la de una persona) — solo se
              autoriza una vez.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex items-center justify-between rounded-lg border p-4'>
              <div>
                <p className='text-sm font-medium'>Estado de conexión</p>
                <p className='text-xs text-muted-foreground'>
                  {connected
                    ? 'Conectada — la sincronización puede crear/actualizar tareas en Planner.'
                    : 'Sin conectar — conecta una cuenta para habilitar la sincronización.'}
                </p>
              </div>
              <div className='flex items-center gap-2'>
                {connected ? (
                  <>
                    <Badge variant='outline' className='text-xs flex items-center gap-1'>
                      <CheckCircle className='h-3 w-3 text-primary' />
                      Conectado
                    </Badge>
                    {canWrite && (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-xs text-muted-foreground hover:text-destructive h-7'
                        onClick={() => void revoke()}
                      >
                        Desconectar
                      </Button>
                    )}
                  </>
                ) : (
                  canWrite && (
                    <Button
                      size='sm'
                      className='text-xs h-7'
                      disabled={authorizing}
                      onClick={() => void authorize()}
                    >
                      Conectar cuenta
                    </Button>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Destino en Planner</CardTitle>
            <CardDescription>
              Grupo de Microsoft 365 y Plan donde se crean las tareas. Se necesita la cuenta
              conectada arriba para listar las opciones.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center justify-between gap-4 rounded-lg border p-4'>
              <div>
                <p className='font-medium'>Sincronización activa</p>
                <p className='text-sm text-muted-foreground'>
                  Si está apagado, crear/editar tareas en la app no envía nada a Planner.
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                disabled={!canWrite}
                onCheckedChange={checked =>
                  setSettings(current => ({ ...current, enabled: checked }))
                }
              />
            </div>

            <div className='flex items-center justify-between gap-4 rounded-lg border p-4'>
              <div>
                <p className='font-medium'>Recibir cambios hechos en Planner</p>
                <p className='text-sm text-muted-foreground'>
                  Si está apagado (recomendado hasta probarlo), la app solo envía tareas a Planner
                  pero nunca trae de vuelta lo que se cambie ahí directamente.
                </p>
              </div>
              <Switch
                checked={settings.syncDirection === 'bidirectional'}
                disabled={!canWrite}
                onCheckedChange={checked =>
                  setSettings(current => ({
                    ...current,
                    syncDirection: checked ? 'bidirectional' : 'outbound',
                  }))
                }
              />
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>Grupo de Microsoft 365</p>
                <Select
                  value={settings.groupId || undefined}
                  disabled={!canWrite || !connected || loadingGroups}
                  onValueChange={value =>
                    setSettings(current => ({ ...current, groupId: value, planId: '' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingGroups ? 'Cargando...' : 'Selecciona un grupo'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>Plan de Planner</p>
                <Select
                  value={settings.planId || undefined}
                  disabled={!canWrite || !settings.groupId || loadingPlans}
                  onValueChange={value => setSettings(current => ({ ...current, planId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingPlans ? 'Cargando...' : 'Selecciona un plan'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle>Estado de sincronización</CardTitle>
                <CardDescription>Últimas 50 tareas sincronizadas o con error.</CardDescription>
              </div>
              <Button variant='ghost' size='icon' onClick={() => void loadSyncStatus()}>
                <RefreshCw className='h-4 w-4' />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {links.length === 0 ? (
              <p className='text-sm text-muted-foreground'>Todavía no hay tareas sincronizadas.</p>
            ) : (
              <div className='space-y-2'>
                {links.map(link => (
                  <div
                    key={link.id}
                    className='flex items-center justify-between gap-4 rounded-lg border p-3 text-sm'
                  >
                    <div className='min-w-0'>
                      <p className='truncate font-medium'>{link.taskTitle}</p>
                      {link.syncError && (
                        <p className='truncate text-xs text-destructive'>{link.syncError}</p>
                      )}
                    </div>
                    <Badge variant={link.syncStatus === 'error' ? 'destructive' : 'outline'}>
                      {link.syncStatus === 'error' ? 'Error' : 'Sincronizado'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  )
}
