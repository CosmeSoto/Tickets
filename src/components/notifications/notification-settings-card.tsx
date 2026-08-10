'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  BellOff,
  Mail,
  Volume2,
  VolumeX,
  Clock,
  Save,
  RefreshCw,
  Activity,
  User,
  MessageCircle,
  AlertCircle,
  Smartphone,
  FilePlus,
  Ticket,
  Package,
  Route,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TimePicker } from '@/components/ui/time-picker'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  NotificationPreferences,
  NotificationSettingsProps,
} from '@/types/notification-preferences'
import {
  requestNotificationPermission,
  getNotificationPermission,
} from '@/hooks/use-notification-sse'

/**
 * Fila de configuración para notificaciones nativas del navegador/SO.
 * Muestra el estado actual del permiso y permite solicitarlo.
 */
function NotificationPermissionRow() {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(
    'default'
  )
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    setPermission(getNotificationPermission())
  }, [])

  const handleRequest = async () => {
    setRequesting(true)
    const granted = await requestNotificationPermission()
    setPermission(granted ? 'granted' : 'denied')
    setRequesting(false)
  }

  if (permission === 'unsupported') return null

  return (
    <div className='flex items-center justify-between'>
      <div className='space-y-0.5'>
        <Label className='text-base flex items-center space-x-2'>
          <Smartphone className='h-4 w-4 text-blue-600 dark:text-blue-400' />
          <span>Notificaciones cuando la app está en segundo plano</span>
        </Label>
        <p className='text-sm text-muted-foreground'>
          Recibe alertas del sistema operativo aunque tengas el navegador minimizado o la pantalla
          bloqueada
        </p>
        {permission === 'denied' && (
          <p className='text-xs text-amber-600 mt-1'>
            ⚠️ Permiso denegado. Para activarlo ve a la configuración de tu navegador →
            Notificaciones.
          </p>
        )}
      </div>
      <div className='flex-shrink-0 ml-4'>
        {permission === 'granted' ? (
          <Badge className='bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'>
            <Bell className='h-3 w-3 mr-1' />
            Activadas
          </Badge>
        ) : permission === 'denied' ? (
          <Badge variant='secondary'>
            <BellOff className='h-3 w-3 mr-1' />
            Bloqueadas
          </Badge>
        ) : (
          <Button size='sm' variant='outline' onClick={handleRequest} disabled={requesting}>
            {requesting ? (
              <RefreshCw className='h-3.5 w-3.5 mr-1.5 animate-spin' />
            ) : (
              <Bell className='h-3.5 w-3.5 mr-1.5' />
            )}
            Activar
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Componente unificado para configuración de notificaciones
 * Soporta 3 niveles: básico, intermedio y avanzado
 */
export function NotificationSettingsCard({
  level,
  preferences,
  onUpdate,
  onSave,
  loading = false,
}: NotificationSettingsProps) {
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave()
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    onUpdate({ [key]: value })
  }

  const updateQuietHours = <K extends keyof NotificationPreferences['quietHours']>(
    key: K,
    value: NotificationPreferences['quietHours'][K]
  ) => {
    onUpdate({
      quietHours: { ...preferences.quietHours, [key]: value },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center space-x-2'>
          <Bell className='h-5 w-5' />
          <span>Notificaciones</span>
        </CardTitle>
        <CardDescription>Configura cómo y cuándo quieres recibir notificaciones</CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* NIVEL BÁSICO - Siempre visible */}
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label className='text-base flex items-center space-x-2'>
                <Mail className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                <span>Notificaciones por email</span>
              </Label>
              <p className='text-sm text-muted-foreground'>
                Master de correo: creación, asignación, plan, resolución, calificación y
                comentarios (si SMTP está activo en Admin). Desactívalo para no recibir ninguno.
              </p>
            </div>
            <Switch
              checked={preferences.emailNotifications}
              onCheckedChange={checked => updatePreference('emailNotifications', checked)}
            />
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label className='text-base flex items-center space-x-2'>
                <Bell className='h-4 w-4 text-purple-600 dark:text-purple-400' />
                <span>Notificaciones push</span>
              </Label>
              <p className='text-sm text-muted-foreground'>
                Recibe notificaciones en tiempo real en el navegador
              </p>
            </div>
            <Switch
              checked={preferences.pushNotifications}
              onCheckedChange={checked => updatePreference('pushNotifications', checked)}
            />
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label className='text-base flex items-center space-x-2'>
                {preferences.soundEnabled ? (
                  <Volume2 className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                ) : (
                  <VolumeX className='h-4 w-4 text-muted-foreground' />
                )}
                <span>Sonido de notificaciones</span>
              </Label>
              <p className='text-sm text-muted-foreground'>
                Reproducir sonido cuando lleguen notificaciones en tiempo real
              </p>
            </div>
            <Switch
              checked={preferences.soundEnabled}
              onCheckedChange={checked => updatePreference('soundEnabled', checked)}
            />
          </div>

          <Separator />

          {/* Permiso de notificaciones del navegador */}
          <NotificationPermissionRow />
        </div>

        {/* Módulos — visible desde básico */}
        <Separator className='my-6' />
        <div className='space-y-4'>
          <h3 className='text-sm font-semibold text-muted-foreground'>Módulos</h3>
          <p className='text-sm text-muted-foreground -mt-2'>
            Activa o silencia notificaciones por área del sistema
          </p>

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label className='text-base flex items-center space-x-2'>
                <Ticket className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                <span>Tickets</span>
              </Label>
              <p className='text-sm text-muted-foreground'>
                También aplica al correo: creación, asignación, comentarios, plan y cambios de
                estado
              </p>
            </div>
            <Switch
              checked={preferences.notifyTickets}
              onCheckedChange={checked => updatePreference('notifyTickets', checked)}
            />
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label className='text-base flex items-center space-x-2'>
                <Package className='h-4 w-4 text-violet-600 dark:text-violet-400' />
                <span>Inventario</span>
              </Label>
              <p className='text-sm text-muted-foreground'>
                Actas, equipos, mantenimiento y alertas de stock
              </p>
            </div>
            <Switch
              checked={preferences.notifyInventory}
              onCheckedChange={checked => updatePreference('notifyInventory', checked)}
            />
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <Label className='text-base flex items-center space-x-2'>
                <Route className='h-4 w-4 text-teal-600 dark:text-teal-400' />
                <span>Rondas</span>
              </Label>
              <p className='text-sm text-muted-foreground'>
                Asignaciones, rondas omitidas/incompletas y sync offline
              </p>
            </div>
            <Switch
              checked={preferences.notifyPatrols}
              onCheckedChange={checked => updatePreference('notifyPatrols', checked)}
            />
          </div>
        </div>

        {/* NIVEL INTERMEDIO - Solo para intermediate y advanced */}
        {(level === 'intermediate' || level === 'advanced') && (
          <>
            <Separator className='my-6' />
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold text-muted-foreground'>
                Tipos de Notificaciones
              </h3>

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label className='text-base flex items-center space-x-2'>
                    <Activity className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                    <span>Actualizaciones de actividad</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cambios en tickets, inventario, rondas y otros módulos
                  </p>
                </div>
                <Switch
                  checked={preferences.ticketUpdates}
                  onCheckedChange={checked => updatePreference('ticketUpdates', checked)}
                />
              </div>

              <Separator />

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label className='text-base flex items-center space-x-2'>
                    <MessageCircle className='h-4 w-4 text-purple-600 dark:text-purple-400' />
                    <span>Nuevos comentarios</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cuando alguien comenta en registros que sigues
                  </p>
                </div>
                <Switch
                  checked={preferences.newComments}
                  onCheckedChange={checked => updatePreference('newComments', checked)}
                />
              </div>

              <Separator />

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label className='text-base flex items-center space-x-2'>
                    <RefreshCw className='h-4 w-4 text-orange-600 dark:text-orange-400' />
                    <span>Cambios de estado</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cuando cambia el estado de tus registros o asignaciones
                  </p>
                </div>
                <Switch
                  checked={preferences.statusChanged}
                  onCheckedChange={checked => updatePreference('statusChanged', checked)}
                />
              </div>

              <Separator />

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label className='text-base flex items-center space-x-2'>
                    <Clock className='h-4 w-4 text-emerald-600 dark:text-emerald-400' />
                    <span>Reporte semanal por email</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cada lunes recibes un resumen de actividad (tickets, alertas y no leídas).
                    Requiere notificaciones por email activadas.
                  </p>
                </div>
                <Switch
                  checked={preferences.weeklyReport}
                  onCheckedChange={checked => updatePreference('weeklyReport', checked)}
                  disabled={!preferences.emailNotifications}
                />
              </div>

              {level === 'advanced' && (
                <>
                  <Separator />

                  <div className='flex items-center justify-between'>
                    <div className='space-y-0.5'>
                      <Label className='text-base flex items-center space-x-2'>
                        <AlertCircle className='h-4 w-4 text-amber-600 dark:text-amber-400' />
                        <span>Alertas del sistema</span>
                      </Label>
                      <p className='text-sm text-muted-foreground'>
                        Notificaciones sobre mantenimiento y actualizaciones
                      </p>
                    </div>
                    <Switch
                      checked={preferences.systemAlerts}
                      onCheckedChange={checked => updatePreference('systemAlerts', checked)}
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* NIVEL AVANZADO - Solo para advanced */}
        {level === 'advanced' && (
          <>
            <Separator className='my-6' />
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold text-muted-foreground'>
                Configuración Avanzada
              </h3>

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label className='text-base flex items-center space-x-2'>
                    <FilePlus className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                    <span>Nuevos registros</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cuando se crean tickets, solicitudes de inventario o incidencias de ronda
                  </p>
                </div>
                <Switch
                  checked={preferences.ticketCreated}
                  onCheckedChange={checked => updatePreference('ticketCreated', checked)}
                />
              </div>

              <Separator />

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label className='text-base flex items-center space-x-2'>
                    <User className='h-4 w-4 text-green-600 dark:text-green-400' />
                    <span>Asignaciones</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cuando te asignan tickets, tareas o equipos
                  </p>
                </div>
                <Switch
                  checked={preferences.ticketAssigned}
                  onCheckedChange={checked => updatePreference('ticketAssigned', checked)}
                />
              </div>

              <Separator />

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label className='text-base flex items-center space-x-2'>
                    <RefreshCw className='h-4 w-4 text-orange-600 dark:text-orange-400' />
                    <span>Cambios de estado</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cuando cambia el estado de un registro en cualquier módulo
                  </p>
                </div>
                <Switch
                  checked={preferences.statusChanged}
                  onCheckedChange={checked => updatePreference('statusChanged', checked)}
                />
              </div>

              <Separator />

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label className='text-base flex items-center space-x-2'>
                    <MessageCircle className='h-4 w-4 text-purple-600 dark:text-purple-400' />
                    <span>Nuevos comentarios</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cuando alguien comenta en un registro que sigues
                  </p>
                </div>
                <Switch
                  checked={preferences.newComments}
                  onCheckedChange={checked => updatePreference('newComments', checked)}
                />
              </div>

              {/* Horarios silenciosos */}
              <Separator className='my-6' />
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label className='text-base flex items-center space-x-2'>
                      <Clock className='h-4 w-4 text-indigo-600 dark:text-indigo-400' />
                      <span>Horarios silenciosos</span>
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      No recibir notificaciones durante ciertos horarios
                    </p>
                  </div>
                  <Switch
                    checked={preferences.quietHours.enabled}
                    onCheckedChange={checked => updateQuietHours('enabled', checked)}
                  />
                </div>

                {preferences.quietHours.enabled && (
                  <div className='grid grid-cols-2 gap-4 pt-4 pl-6 border-l-2 border-indigo-200 dark:border-indigo-800'>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Hora de inicio</Label>
                      <TimePicker
                        value={preferences.quietHours.startTime}
                        onChange={v => updateQuietHours('startTime', v)}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Hora de fin</Label>
                      <TimePicker
                        value={preferences.quietHours.endTime}
                        onChange={v => updateQuietHours('endTime', v)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Botones de acción */}
        <div className='flex items-center justify-end pt-6 border-t'>
          <Button onClick={handleSave} disabled={saving || loading} size='sm'>
            {saving ? (
              <>
                <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                Guardando...
              </>
            ) : (
              <>
                <Save className='h-4 w-4 mr-2' />
                Guardar Notificaciones
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
