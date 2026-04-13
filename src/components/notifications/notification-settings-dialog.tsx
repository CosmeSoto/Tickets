'use client'

import { useState } from 'react'
import { 
  Bell, 
  Mail, 
  Volume2, 
  VolumeX, 
  Clock, 
  Save,
  RefreshCw,
  Ticket,
  User,
  MessageCircle,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { NotificationPreferences } from '@/hooks/use-notifications'

interface NotificationPreferencesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preferences: NotificationPreferences
  onSave: (preferences: Partial<NotificationPreferences>) => Promise<void>
  loading: boolean
}

export function NotificationSettingsDialog({
  open,
  onOpenChange,
  preferences,
  onSave,
  loading,
}: NotificationPreferencesProps) {
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences>(preferences)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(localPreferences)
      onOpenChange(false)
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setLocalPreferences(preferences)
    onOpenChange(false)
  }

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setLocalPreferences(prev => ({ ...prev, [key]: value }))
  }

  const updateQuietHours = <K extends keyof NotificationPreferences['quietHours']>(
    key: K,
    value: NotificationPreferences['quietHours'][K]
  ) => {
    setLocalPreferences(prev => ({
      ...prev,
      quietHours: { ...prev.quietHours, [key]: value }
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Preferencias de Notificaciones</span>
          </DialogTitle>
          <DialogDescription>
            Configura cómo y cuándo quieres recibir notificaciones del sistema
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Configuración general */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Bell className="h-4 w-4" />
                <span>Configuración General</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Notificaciones por email</Label>
                  <p className="text-xs text-muted-foreground">
                    Recibir notificaciones importantes por correo electrónico
                  </p>
                </div>
                <Switch
                  checked={localPreferences.emailNotifications}
                  onCheckedChange={(checked) => updatePreference('emailNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Notificaciones push</Label>
                  <p className="text-xs text-muted-foreground">
                    Mostrar notificaciones del navegador en tiempo real
                  </p>
                </div>
                <Switch
                  checked={localPreferences.pushNotifications}
                  onCheckedChange={(checked) => updatePreference('pushNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center space-x-1">
                    {localPreferences.soundEnabled ? (
                      <Volume2 className="h-3 w-3" />
                    ) : (
                      <VolumeX className="h-3 w-3" />
                    )}
                    <span>Sonidos de notificación</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Reproducir sonido cuando lleguen notificaciones
                  </p>
                </div>
                <Switch
                  checked={localPreferences.soundEnabled}
                  onCheckedChange={(checked) => updatePreference('soundEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tipos de notificaciones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <AlertCircle className="h-4 w-4" />
                <span>Tipos de Notificaciones</span>
              </CardTitle>
              <CardDescription>
                Selecciona qué tipos de eventos quieres que te notifiquen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center space-x-2">
                    <Ticket className="h-3 w-3 text-blue-600" />
                    <span>Tickets creados</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Cuando se crea un nuevo ticket en el sistema
                  </p>
                </div>
                <Switch
                  checked={localPreferences.ticketCreated}
                  onCheckedChange={(checked) => updatePreference('ticketCreated', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center space-x-2">
                    <User className="h-3 w-3 text-green-600" />
                    <span>Tickets asignados</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Cuando te asignan un ticket o asignas uno a alguien más
                  </p>
                </div>
                <Switch
                  checked={localPreferences.ticketAssigned}
                  onCheckedChange={(checked) => updatePreference('ticketAssigned', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center space-x-2">
                    <RefreshCw className="h-3 w-3 text-orange-600" />
                    <span>Cambios de estado</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Cuando cambia el estado de un ticket (abierto, en progreso, resuelto, etc.)
                  </p>
                </div>
                <Switch
                  checked={localPreferences.statusChanged}
                  onCheckedChange={(checked) => updatePreference('statusChanged', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center space-x-2">
                    <MessageCircle className="h-3 w-3 text-purple-600" />
                    <span>Nuevos comentarios</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Cuando alguien comenta en un ticket que sigues
                  </p>
                </div>
                <Switch
                  checked={localPreferences.newComments}
                  onCheckedChange={(checked) => updatePreference('newComments', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center space-x-2">
                    <AlertCircle className="h-3 w-3 text-yellow-600" />
                    <span>Tickets actualizados</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Cuando se actualiza información de un ticket
                  </p>
                </div>
                <Switch
                  checked={localPreferences.ticketUpdated}
                  onCheckedChange={(checked) => updatePreference('ticketUpdated', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Horarios silenciosos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Horarios Silenciosos</span>
              </CardTitle>
              <CardDescription>
                Configura horarios en los que no quieres recibir notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Activar horarios silenciosos</Label>
                  <p className="text-xs text-muted-foreground">
                    No recibir notificaciones durante ciertos horarios
                  </p>
                </div>
                <Switch
                  checked={localPreferences.quietHours.enabled}
                  onCheckedChange={(checked) => updateQuietHours('enabled', checked)}
                />
              </div>

              {localPreferences.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="startTime" className="text-sm font-medium">
                      Hora de inicio
                    </Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={localPreferences.quietHours.startTime}
                      onChange={(e) => updateQuietHours('startTime', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime" className="text-sm font-medium">
                      Hora de fin
                    </Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={localPreferences.quietHours.endTime}
                      onChange={(e) => updateQuietHours('endTime', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información adicional */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-blue-900">
                    Sobre las notificaciones
                  </h4>
                  <p className="text-xs text-blue-700">
                    Las notificaciones te ayudan a mantenerte al día con los tickets importantes. 
                    Puedes personalizar qué tipos de eventos quieres recibir y cómo quieres ser notificado.
                  </p>
                  <p className="text-xs text-blue-700 mt-2">
                    Los horarios silenciosos solo afectan las notificaciones push y sonidos, 
                    pero seguirás recibiendo emails para eventos críticos.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Preferencias
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}