'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  Target,
  Award,
  Calendar,
  Zap,
  Users,
  Star,
  Activity,
  RefreshCw,
  Settings as SettingsIcon,
  Bell,
  Mail,
  Moon,
  Globe,
  Shield,
  Eye,
  Save,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UserSettings {
  emailNotifications: boolean
  pushNotifications: boolean
  autoAssignEnabled: boolean
  maxConcurrentTickets: number
  theme: string
  language: string
  timezone: string
}

export default function ClientSettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [settings, setSettings] = useState<UserSettings>({
    emailNotifications: true,
    pushNotifications: true,
    autoAssignEnabled: false, // Clientes no necesitan auto-asignación
    maxConcurrentTickets: 10,
    theme: 'light',
    language: 'es',
    timezone: 'America/Guayaquil',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'CLIENT') {
      router.push('/unauthorized')
      return
    }

    loadSettings()
  }, [session, router])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/user/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.settings) {
          setSettings(data.settings)
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Configuración guardada',
          description: 'Tus preferencias se actualizaron correctamente',
        })
      } else {
        throw new Error(data.error || 'Error al guardar configuración')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: 'Error al guardar',
        description: error instanceof Error ? error.message : 'No se pudieron guardar los cambios',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    loadSettings()
    toast({
      title: 'Configuración restaurada',
      description: 'Se restauraron los valores guardados',
      variant: 'success',
    })
  }

  if (isLoading) {
    return (
      <RoleDashboardLayout title="Configuración" subtitle="Gestiona tus preferencias">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title="Configuración"
      subtitle="Gestiona tus preferencias y notificaciones"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Información del Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SettingsIcon className="h-5 w-5 mr-2 text-blue-600" />
              Información del Perfil
            </CardTitle>
            <CardDescription>
              Tu información personal y de contacto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <div className="mt-1 p-2 bg-muted rounded-md text-sm">
                {session?.user?.name || 'No disponible'}
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <div className="mt-1 p-2 bg-muted rounded-md text-sm">
                {session?.user?.email || 'No disponible'}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Para cambiar tu información personal, contacta al administrador
            </p>
          </CardContent>
        </Card>

        {/* Notifications Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="h-5 w-5 mr-2 text-blue-600" />
              Notificaciones
            </CardTitle>
            <CardDescription>
              Configura cómo y cuándo quieres recibir notificaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-notifications">Notificaciones por Email</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones en tu correo electrónico
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={settings?.emailNotifications ?? true}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, emailNotifications: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-notifications">Notificaciones Push</Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones en tiempo real
                </p>
              </div>
              <Switch
                id="push-notifications"
                checked={settings?.pushNotifications ?? true}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, pushNotifications: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="h-5 w-5 mr-2 text-purple-600" />
              Preferencias
            </CardTitle>
            <CardDescription>
              Personaliza tu experiencia en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="language">Idioma</Label>
              <Select
                value={settings?.language ?? 'es'}
                onValueChange={(value) =>
                  setSettings({ ...settings, language: value })
                }
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="pt">Português</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Zona Horaria</Label>
              <Select
                value="America/Guayaquil"
                disabled
              >
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Guayaquil">Guayaquil, Ecuador (GMT-5)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sistema configurado para Ecuador
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">Tema</Label>
              <Select
                value={settings?.theme ?? 'light'}
                onValueChange={(value) =>
                  setSettings({ ...settings, theme: value })
                }
              >
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Oscuro</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-4">
          <Button variant="outline" onClick={handleReset} disabled={isSaving}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Restaurar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
