'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Save, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

type ProcessSettings = {
  macroPrefix: string
  processPrefix: string
  procedurePrefix: string
  defaultReviewMonths: number
  requireExternalDpdForCritical: boolean
}

const initialSettings: ProcessSettings = {
  macroPrefix: 'MP',
  processPrefix: 'PR',
  procedurePrefix: 'FO',
  defaultReviewMonths: 12,
  requireExternalDpdForCritical: false,
}

export default function ProcessSettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [settings, setSettings] = useState(initialSettings)
  const [canWrite, setCanWrite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/processes/settings')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No fue posible cargar la configuración.')
      setSettings({ ...initialSettings, ...data.settings })
      setCanWrite(data.canWrite === true)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error de configuración.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!canWrite) return
    try {
      setSaving(true)
      const response = await fetch('/api/admin/processes/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
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
      title='Configuración de Procesos'
      subtitle='Parámetros operativos del catálogo; no altera las áreas ni carga datos de práctica.'
      loading={loading}
      error={error}
      onRetry={load}
      headerActions={
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => router.push('/admin/processes')}>
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
      <Card className='max-w-2xl'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Settings className='h-5 w-5' />
            Control documental
          </CardTitle>
          <CardDescription>
            Prefijos para la codificación institucional y política de revisión del módulo.
            {!canWrite && ' Solo Super Admin puede modificar estos valores.'}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-2'>
              <Label>Prefijo macroproceso (N0)</Label>
              <Input
                value={settings.macroPrefix}
                disabled={!canWrite}
                onChange={event =>
                  setSettings(current => ({ ...current, macroPrefix: event.target.value }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label>Prefijo proceso (N1)</Label>
              <Input
                value={settings.processPrefix}
                disabled={!canWrite}
                onChange={event =>
                  setSettings(current => ({ ...current, processPrefix: event.target.value }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label>Prefijo formato/procedimiento</Label>
              <Input
                value={settings.procedurePrefix}
                disabled={!canWrite}
                onChange={event =>
                  setSettings(current => ({ ...current, procedurePrefix: event.target.value }))
                }
              />
            </div>
          </div>
          <div className='space-y-2'>
            <Label>Revisión por defecto (meses)</Label>
            <Input
              className='max-w-40'
              type='number'
              min={1}
              max={60}
              disabled={!canWrite}
              value={settings.defaultReviewMonths}
              onChange={event =>
                setSettings(current => ({
                  ...current,
                  defaultReviewMonths: Number(event.target.value) || 12,
                }))
              }
            />
          </div>
          <div className='flex items-center justify-between gap-4 rounded-lg border p-4'>
            <div>
              <p className='font-medium'>Revisión externa DPD para criticidad crítica</p>
              <p className='text-sm text-muted-foreground'>
                Si está activo, los procesos críticos no pueden publicarse sin pasar por DPD
                externo.
              </p>
            </div>
            <Switch
              checked={settings.requireExternalDpdForCritical}
              disabled={!canWrite}
              onCheckedChange={checked =>
                setSettings(current => ({ ...current, requireExternalDpdForCritical: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>
    </ModuleLayout>
  )
}
