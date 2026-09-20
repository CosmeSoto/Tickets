'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Save, CheckCircle, RefreshCw } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { OAuthCredentialsStatusLink } from '@/components/settings/oauth-credentials-fields'

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
  }, [load, loadSyncStatus])

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
              Se configuran una sola vez para todo el sistema en Ajustes → OAuth, junto con las
              demás credenciales de Microsoft (login, SharePoint).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OAuthCredentialsStatusLink provider='azure-ad-planner' />
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
