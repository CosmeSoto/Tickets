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
  Ticket,
  User,
  MessageCircle,
  AlertCircle,
  Smartphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  NotificationPreferences,
  NotificationSettingsProps,
} from '@/types/notification-preferences'
import { requestNotificationPermission, getNotificationPermission } from '@/hooks/use-notification-sse'

/**
 * Fila de configuración para notificaciones nativas del navegador/SO.
 * Muestra el estado actual del permiso y permite solicitarlo.
 */
function NotificationPermissionRow() {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default')
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
          <Smartphone className='h-4 w-4 text-blue-600' />
          <span>Notificaciones cuando la app está en segundo plano</span>
        </Label>
        <p className='text-sm text-muted-foreground'>
          Recibe alertas del sistema operativo aunque tengas el navegador minimizado o la pantalla bloqueada
        </p>
        {permission === 'denied' && (
          <p className='text-xs text-amber-600 mt-1'>
            ⚠️ Permiso denegado. Para activarlo ve a la configuración de tu navegador → Notificaciones.
          </p>
        )}
      </div>
      <div className='flex-shrink-0 ml-4'>
        {permission === 'granted' ? (
          <Badge className='bg-green-100 text-green-700 border-green-200'>
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
                <Mail className='h-4 w-4 text-blue-600' />
                <span>Notificaciones por email</span>
              </Label>
              <p className='text-sm text-muted-foreground'>
                Recibe notificaciones importantes en tu correo
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
                <Bell className='h-4 w-4 text-purple-600' />
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
                  <Volume2 className='h-4 w-4 text-blue-600' />
                ) : (
                  <VolumeX className='h-4 w-4 text-gray-400' />
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
                    <Ticket className='h-4 w-4 text-blue-600' />
                    <span>Actualizaciones de tickets</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Notificaciones cuando hay cambios en tus tickets
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
                    <MessageCircle className='h-4 w-4 text-purple-600' />
                    <span>Nuevos comentarios</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cuando alguien comenta en tus tickets
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
                    <RefreshCw className='h-4 w-4 text-orange-600' />
                    <span>Cambios de estado</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cuando cambia el estado de tus tickets
                  </p>
                </div>
                <Switch
                  checked={preferences.statusChanged}
                  onCheckedChange={checked => updatePreference('statusChanged', checked)}
                />
              </div>

              {level === 'advanced' && (
                <>
                  <Separator />

                  <div className='flex items-center justify-between'>
                    <div className='space-y-0.5'>
                      <Label className='text-base flex items-center space-x-2'>
                        <AlertCircle className='h-4 w-4 text-orange-600' />
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

                  <Separator />

                  <div className='flex items-center justify-between'>
                    <div className='space-y-0.5'>
                      <Label className='text-base flex items-center space-x-2'>
                        <Clock className='h-4 w-4 text-green-600' />
                        <span>Reporte semanal</span>
                      </Label>
                      <p className='text-sm text-muted-foreground'>
                        Resumen semanal de tu actividad por email
                      </p>
                    </div>
                    <Switch
                      checked={preferences.weeklyReport}
                      onCheckedChange={checked => updatePreference('weeklyReport', checked)}
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
                    <Ticket className='h-4 w-4 text-blue-600' />
                    <span>Tickets creados</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cuando se crea un nuevo ticket en el sistema
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
                    <User className='h-4 w-4 text-green-600' />
                    <span>Tickets asignados</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>Cuando te asignan un ticket</p>
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
                    <RefreshCw className='h-4 w-4 text-orange-600' />
                    <span>Cambios de estado</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cuando cambia el estado de un ticket
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
                    <MessageCircle className='h-4 w-4 text-purple-600' />
                    <span>Nuevos comentarios</span>
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Cuando alguien comenta en un ticket que sigues
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
                      <Clock className='h-4 w-4 text-indigo-600' />
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
                  <div className='grid grid-cols-2 gap-4 pt-4 pl-6 border-l-2 border-indigo-200'>
                    <div className='space-y-2'>
                      <Label htmlFor='startTime' className='text-sm font-medium'>
                        Hora de inicio
                      </Label>
                      <Input
                        id='startTime'
                        type='time'
                        value={preferences.quietHours.startTime}
                        onChange={e => updateQuietHours('startTime', e.target.value)}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='endTime' className='text-sm font-medium'>
                        Hora de fin
                      </Label>
                      <Input
                        id='endTime'
                        type='time'
                        value={preferences.quietHours.endTime}
                        onChange={e => updateQuietHours('endTime', e.target.value)}
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
