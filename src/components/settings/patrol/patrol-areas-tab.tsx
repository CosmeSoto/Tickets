/**
 * Pestaña de configuración de patrullas por área.
 * Layout de dos columnas: lista de familias (izq) + panel de config (der).
 * Sigue el mismo patrón que inventory-areas-tab.tsx.
 */

'use client'

import { useEffect, useState } from 'react'
import {
  Shield,
  ChevronRight,
  RefreshCw,
  QrCode,
  MapPin,
  Camera,
  Wifi,
  Bell,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FamilyIcon } from '@/components/inventory/family-badge'
import type { PatrolFamily, PatrolFormState } from '@/hooks/use-patrol-settings'

interface PatrolAreasTabProps {
  isSuperAdmin: boolean
  families: PatrolFamily[]
  selectedFamilyId: string | null
  selectedFamily: PatrolFamily | undefined
  form: PatrolFormState
  loadingFamilies: boolean
  loadingConfig: boolean
  saving: boolean
  onSelectFamily: (id: string) => void
  onTogglePatrols: (family: PatrolFamily) => void
  onSetField: <K extends keyof PatrolFormState>(key: K, value: PatrolFormState[K]) => void
}

export function PatrolAreasTab({
  isSuperAdmin,
  families,
  selectedFamilyId,
  selectedFamily,
  form,
  loadingFamilies,
  loadingConfig,
  saving,
  onSelectFamily,
  onTogglePatrols,
  onSetField,
}: PatrolAreasTabProps) {
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetch('/api/categories/simple?isActive=true')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        const list = data?.categories ?? data?.data ?? []
        setCategories(Array.isArray(list) ? list : [])
      })
      .catch(() => setCategories([]))
  }, [])

  return (
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
      {/* ── Lista de familias ── */}
      <div className='lg:col-span-1'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base flex items-center gap-2'>
              <Shield className='h-4 w-4' />
              Áreas
            </CardTitle>
            <CardDescription>Selecciona un área para configurar sus patrullas</CardDescription>
          </CardHeader>
          <CardContent className='p-0'>
            {loadingFamilies ? (
              <div className='flex items-center justify-center py-8'>
                <RefreshCw className='h-5 w-5 animate-spin text-muted-foreground' />
              </div>
            ) : families.length === 0 ? (
              <div className='p-4 text-sm text-muted-foreground text-center'>
                No hay áreas disponibles
              </div>
            ) : (
              <div className='divide-y'>
                {families.map(family => (
                  <div
                    key={family.id}
                    className={`flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                      selectedFamilyId === family.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                    }`}
                    onClick={() => onSelectFamily(family.id)}
                    role='button'
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && onSelectFamily(family.id)}
                  >
                    <div className='flex items-center gap-2 min-w-0 flex-1'>
                      <div
                        className='w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0'
                        style={{ backgroundColor: family.color || '#6B7280' }}
                      >
                        <FamilyIcon
                          icon={family.icon}
                          color={family.color}
                          code={family.code}
                          className='w-4 h-4'
                        />
                      </div>
                      <div className='min-w-0'>
                        <p className='text-sm font-medium leading-tight truncate'>{family.name}</p>
                        <p className='text-xs text-muted-foreground font-mono'>{family.code}</p>
                      </div>
                    </div>
                    <div
                      className='flex items-center gap-1 flex-shrink-0 ml-2'
                      onClick={e => e.stopPropagation()}
                    >
                      <Switch
                        checked={family.patrolsEnabled ?? true}
                        onCheckedChange={() => onTogglePatrols(family)}
                        className='scale-75'
                        disabled={!isSuperAdmin}
                        aria-label={`Habilitar patrullas para ${family.name}`}
                      />
                      <ChevronRight className='h-4 w-4 text-muted-foreground' />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Panel de configuración ── */}
      <div className='lg:col-span-2'>
        {!selectedFamilyId ? (
          <Card className='h-full'>
            <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
              <Shield className='h-12 w-12 text-muted-foreground/30 mb-4' />
              <p className='text-sm font-medium text-muted-foreground'>Selecciona un área</p>
              <p className='text-xs text-muted-foreground mt-1'>
                Elige un área de la lista para configurar sus parámetros de patrullaje
              </p>
            </CardContent>
          </Card>
        ) : loadingConfig ? (
          <Card className='h-full'>
            <CardContent className='flex items-center justify-center py-16'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
            </CardContent>
          </Card>
        ) : (
          <div className='space-y-4'>
            {/* Header del área seleccionada */}
            {selectedFamily && (
              <div className='flex items-center gap-3 p-4 rounded-lg border bg-card'>
                <div
                  className='w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0'
                  style={{ backgroundColor: selectedFamily.color || '#6B7280' }}
                >
                  <FamilyIcon
                    icon={selectedFamily.icon}
                    color={selectedFamily.color}
                    code={selectedFamily.code}
                    className='w-5 h-5'
                  />
                </div>
                <div>
                  <p className='font-medium text-sm'>{selectedFamily.name}</p>
                  <p className='text-xs text-muted-foreground font-mono'>{selectedFamily.code}</p>
                </div>
                <Badge variant={form.patrolsEnabled ? 'default' : 'secondary'} className='ml-auto'>
                  {form.patrolsEnabled ? 'Habilitado' : 'Deshabilitado'}
                </Badge>
              </div>
            )}

            {/* ── QR Settings ── */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center gap-2'>
                  <QrCode className='h-4 w-4' />
                  Configuración QR
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div className='space-y-1.5'>
                    <Label htmlFor='qrWindowMinutes' className='text-xs'>
                      Ventana de rotación QR (minutos)
                    </Label>
                    <Input
                      id='qrWindowMinutes'
                      type='number'
                      min={1}
                      max={60}
                      value={form.qrWindowMinutes}
                      onChange={e => onSetField('qrWindowMinutes', parseInt(e.target.value) || 5)}
                      disabled={saving}
                      className='h-8 text-sm'
                    />
                    <p className='text-xs text-muted-foreground'>Rango: 1–60 min</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── GPS Settings ── */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center gap-2'>
                  <MapPin className='h-4 w-4' />
                  Configuración GPS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-1.5'>
                  <Label htmlFor='geofenceRadius' className='text-xs'>
                    Radio de geofence (metros)
                  </Label>
                  <Input
                    id='geofenceRadius'
                    type='number'
                    min={1}
                    max={5000}
                    value={form.geofenceRadiusMeters}
                    onChange={e =>
                      onSetField('geofenceRadiusMeters', parseInt(e.target.value) || 1)
                    }
                    disabled={saving}
                    className='h-8 text-sm'
                  />
                  <p className='text-xs text-muted-foreground'>Rango: 1–5000 m. Default: 1 m</p>
                </div>
              </CardContent>
            </Card>

            {/* ── Photo Settings ── */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center gap-2'>
                  <Camera className='h-4 w-4' />
                  Configuración de Fotos
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                  <div className='space-y-1.5'>
                    <Label htmlFor='photoRetentionDays' className='text-xs'>
                      Retención (días)
                    </Label>
                    <Input
                      id='photoRetentionDays'
                      type='number'
                      min={1}
                      max={3650}
                      value={form.photoRetentionDays}
                      onChange={e =>
                        onSetField('photoRetentionDays', parseInt(e.target.value) || 90)
                      }
                      disabled={saving}
                      className='h-8 text-sm'
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label htmlFor='photoQuality' className='text-xs'>
                      Calidad (0.1–1.0)
                    </Label>
                    <Input
                      id='photoQuality'
                      type='number'
                      min={0.1}
                      max={1.0}
                      step={0.01}
                      value={form.photoCompressionQuality}
                      onChange={e =>
                        onSetField('photoCompressionQuality', parseFloat(e.target.value) || 0.82)
                      }
                      disabled={saving}
                      className='h-8 text-sm'
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label htmlFor='photoMaxWidth' className='text-xs'>
                      Ancho máx. (px)
                    </Label>
                    <Input
                      id='photoMaxWidth'
                      type='number'
                      min={320}
                      max={4096}
                      value={form.photoMaxWidthPx}
                      onChange={e =>
                        onSetField('photoMaxWidthPx', parseInt(e.target.value) || 1280)
                      }
                      disabled={saving}
                      className='h-8 text-sm'
                    />
                  </div>
                </div>
                <Separator />
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <Label className='text-xs font-medium'>Foto al iniciar ronda</Label>
                      <p className='text-xs text-muted-foreground'>Requerir foto al comenzar</p>
                    </div>
                    <Switch
                      checked={form.requirePhotoOnStart}
                      onCheckedChange={v => onSetField('requirePhotoOnStart', v)}
                      disabled={saving}
                    />
                  </div>
                  <div className='flex items-center justify-between'>
                    <div>
                      <Label className='text-xs font-medium'>Foto al finalizar ronda</Label>
                      <p className='text-xs text-muted-foreground'>Requerir foto al cerrar</p>
                    </div>
                    <Switch
                      checked={form.requirePhotoOnEnd}
                      onCheckedChange={v => onSetField('requirePhotoOnEnd', v)}
                      disabled={saving}
                    />
                  </div>
                </div>
                <Separator />
                <div className='flex items-start justify-between gap-4 p-3 rounded-lg border bg-muted/30'>
                  <div className='space-y-1 flex-1'>
                    <Label className='text-xs font-medium'>Cerrar al completar obligatorios</Label>
                    <p className='text-xs text-muted-foreground'>
                      Al validar el último checkpoint obligatorio, la ronda pasa a Completada
                      automáticamente. Si exiges foto al finalizar, el agente debe pulsar Finalizar.
                    </p>
                    {form.requirePhotoOnEnd && form.autoCompleteWhenAllRequired && (
                      <p className='text-xs text-amber-600 dark:text-amber-400 font-medium'>
                        Foto al finalizar activa — el auto-cierre quedará en pausa hasta que el
                        agente finalice con foto.
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={form.autoCompleteWhenAllRequired}
                    onCheckedChange={v => onSetField('autoCompleteWhenAllRequired', v)}
                    disabled={saving}
                    aria-label='Cerrar ronda al completar checkpoints obligatorios'
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Offline Settings ── */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center gap-2'>
                  <Wifi className='h-4 w-4' />
                  Configuración Offline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-1.5'>
                  <Label htmlFor='offlineTolerance' className='text-xs'>
                    Tolerancia de sincronización offline (minutos)
                  </Label>
                  <Input
                    id='offlineTolerance'
                    type='number'
                    min={0}
                    max={1440}
                    value={form.offlineSyncToleranceMinutes}
                    onChange={e =>
                      onSetField('offlineSyncToleranceMinutes', parseInt(e.target.value) || 30)
                    }
                    disabled={saving}
                    className='h-8 text-sm'
                  />
                  <p className='text-xs text-muted-foreground'>
                    Margen de tiempo permitido para check-ins offline. Rango: 0–1440 min
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── Alerts ── */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center gap-2'>
                  <Bell className='h-4 w-4' />
                  Alertas y Horarios
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div className='space-y-1.5'>
                    <Label htmlFor='alertThreshold' className='text-xs'>
                      Umbral de alerta de completitud (%)
                    </Label>
                    <Input
                      id='alertThreshold'
                      type='number'
                      min={0}
                      max={100}
                      value={form.alertCompletionThreshold}
                      onChange={e =>
                        onSetField('alertCompletionThreshold', parseInt(e.target.value) || 80)
                      }
                      disabled={saving}
                      className='h-8 text-sm'
                    />
                    <p className='text-xs text-muted-foreground'>
                      Notificar si la completitud cae por debajo de este valor
                    </p>
                  </div>
                  <div className='space-y-1.5'>
                    <Label htmlFor='gracePeriod' className='text-xs'>
                      Período de gracia (minutos)
                    </Label>
                    <Input
                      id='gracePeriod'
                      type='number'
                      min={0}
                      max={120}
                      value={form.gracePeriodMinutes}
                      onChange={e =>
                        onSetField('gracePeriodMinutes', parseInt(e.target.value) || 5)
                      }
                      disabled={saving}
                      className='h-8 text-sm'
                    />
                    <p className='text-xs text-muted-foreground'>
                      Ventana de inicio/escaneo (inicio − gracia … fin + gracia) y cierre automático
                      por vencimiento si la ronda sigue En Progreso
                    </p>
                  </div>
                  <div className='space-y-1.5'>
                    <Label htmlFor='reminderMinutes' className='text-xs'>
                      Recordatorio antes (minutos)
                    </Label>
                    <Input
                      id='reminderMinutes'
                      type='number'
                      min={1}
                      max={60}
                      value={form.reminderMinutesBefore ?? 5}
                      onChange={e =>
                        onSetField('reminderMinutesBefore', parseInt(e.target.value) || 5)
                      }
                      disabled={saving}
                      className='h-8 text-sm'
                    />
                    <p className='text-xs text-muted-foreground'>
                      Minutos antes de enviar notificación al agente de que su ronda está por
                      iniciar
                    </p>
                  </div>
                </div>
                <Separator />
                {/* ── Control de horario estricto ── */}
                <div className='flex items-start justify-between gap-4 p-3 rounded-lg border bg-muted/30'>
                  <div className='space-y-1 flex-1'>
                    <Label className='text-xs font-medium flex items-center gap-1.5'>
                      <Clock className='h-3.5 w-3.5 text-primary' />
                      Validación estricta de horario
                    </Label>
                    <p className='text-xs text-muted-foreground'>
                      Cuando está activo, el agente solo puede iniciar la ronda dentro del horario
                      programado (inicio − gracia hasta fin + gracia). Si está desactivado, puede
                      iniciar en cualquier momento.
                    </p>
                    <p className='text-xs text-amber-600 dark:text-amber-400 font-medium'>
                      {form.strictTimeValidation
                        ? `Activo — ventana: inicio −${form.gracePeriodMinutes} min → fin +${form.gracePeriodMinutes} min`
                        : 'Inactivo — el agente puede iniciar sin restricción de horario'}
                    </p>
                  </div>
                  <Switch
                    checked={form.strictTimeValidation}
                    onCheckedChange={v => onSetField('strictTimeValidation', v)}
                    disabled={saving}
                    aria-label='Activar validación estricta de horario'
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Incident category ── */}
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center gap-2'>
                  <AlertTriangle className='h-4 w-4' />
                  Incidentes de ronda
                </CardTitle>
                <CardDescription className='text-xs'>
                  Categoría de ticket que se crea automáticamente cuando se reporta un incidente
                  durante una ronda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={form.patrolIncidentCategoryId ?? '__none__'}
                  onValueChange={v =>
                    onSetField('patrolIncidentCategoryId', v === '__none__' ? null : v)
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Sin categoría asignada' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>Sin categoría asignada</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
