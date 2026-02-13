'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Bell, Mail, User, Shield } from 'lucide-react'

interface TechnicianSettings {
  emailNotifications: boolean
  pushNotifications: boolean
  autoAssignEnabled: boolean
  maxConcurrentTickets: number
}

export default function TechnicianSettingsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<TechnicianSettings>({
    emailNotifications: true,
    pushNotifications: true,
    autoAssignEnabled: true,
    maxConcurrentTickets: 10
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/user/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.settings) {
          setSettings(data.settings)
        }
      } else {
        console.error('Error loading settings:', response.statusText)
        toast({
          title: 'Error',
          description: 'No se pudo cargar la configuración',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración',
        variant: 'destructive'
      })
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Configuración guardada',
          description: 'Tus preferencias han sido actualizadas correctamente'
        })
      } else {
        throw new Error(data.error || 'Error al guardar')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo guardar la configuración',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <RoleDashboardLayout
      title="Configuración"
      subtitle="Administra tus preferencias y configuración de cuenta"
    >
      <div className="grid gap-6">
        {/* Información del perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información del Perfil
            </CardTitle>
            <CardDescription>
              Tu información personal y de contacto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input 
                value={session?.user?.name || ''} 
                disabled 
                className="mt-1"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                value={session?.user?.email || ''} 
                disabled 
                className="mt-1"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Para cambiar tu información personal, contacta al administrador
            </p>
          </CardContent>
        </Card>

        {/* Notificaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
            <CardDescription>
              Configura cómo quieres recibir notificaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notificaciones por Email</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe actualizaciones de tickets por correo electrónico
                </p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, emailNotifications: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notificaciones Push</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones en tiempo real en el navegador
                </p>
              </div>
              <Switch
                checked={settings.pushNotifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, pushNotifications: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Asignación automática */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Asignación de Tickets
            </CardTitle>
            <CardDescription>
              Configura cómo se te asignan los tickets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Asignación Automática</Label>
                <p className="text-sm text-muted-foreground">
                  Permite que se te asignen tickets automáticamente
                </p>
              </div>
              <Switch
                checked={settings.autoAssignEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, autoAssignEnabled: checked })
                }
              />
            </div>
            <div>
              <Label>Máximo de Tickets Concurrentes</Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={settings.maxConcurrentTickets}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxConcurrentTickets: parseInt(e.target.value) || 10
                  })
                }
                className="mt-1 max-w-xs"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Número máximo de tickets activos que puedes tener asignados
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Botón de guardar */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
