'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Bell,
  Save
} from 'lucide-react'

interface UserSettings {
  notifications: {
    email: boolean
    push: boolean
    ticketUpdates: boolean
    systemAlerts: boolean
    weeklyReport: boolean
  }
}

interface NotificationSettingsProps {
  settings: UserSettings
  onUpdateSetting: (key: keyof UserSettings['notifications'], value: boolean) => void
  onSave: () => void
  loading: boolean
}

export function NotificationSettings({ settings, onUpdateSetting, onSave, loading }: NotificationSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bell className="h-5 w-5" />
          <span>Notificaciones</span>
        </CardTitle>
        <CardDescription>
          Configura cómo y cuándo quieres recibir notificaciones
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Notificaciones por email</Label>
              <p className="text-sm text-muted-foreground">
                Recibe notificaciones importantes en tu correo
              </p>
            </div>
            <Switch
              checked={settings.notifications.email}
              onCheckedChange={(value) => onUpdateSetting('email', value)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Notificaciones push</Label>
              <p className="text-sm text-muted-foreground">
                Recibe notificaciones en tiempo real en el navegador
              </p>
            </div>
            <Switch
              checked={settings.notifications.push}
              onCheckedChange={(value) => onUpdateSetting('push', value)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Actualizaciones de tickets</Label>
              <p className="text-sm text-muted-foreground">
                Notificaciones cuando hay cambios en tus tickets
              </p>
            </div>
            <Switch
              checked={settings.notifications.ticketUpdates}
              onCheckedChange={(value) => onUpdateSetting('ticketUpdates', value)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Alertas del sistema</Label>
              <p className="text-sm text-muted-foreground">
                Notificaciones sobre mantenimiento y actualizaciones
              </p>
            </div>
            <Switch
              checked={settings.notifications.systemAlerts}
              onCheckedChange={(value) => onUpdateSetting('systemAlerts', value)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Reporte semanal</Label>
              <p className="text-sm text-muted-foreground">
                Resumen semanal de tu actividad por email
              </p>
            </div>
            <Switch
              checked={settings.notifications.weeklyReport}
              onCheckedChange={(value) => onUpdateSetting('weeklyReport', value)}
            />
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={loading} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Guardando...' : 'Guardar Notificaciones'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}