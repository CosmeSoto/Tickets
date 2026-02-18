'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw, Settings as SettingsIcon, Globe, Save } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NotificationSettingsUnified } from '@/components/notifications/notification-settings-unified'
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '@/types/notification-preferences'

interface UserSettings {
  theme: string
  language: string
  timezone: string
}

export default function ClientSettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [settings, setSettings] = useState<UserSettings>({
    theme: 'light',
    language: 'es',
    timezone: 'America/Guayaquil',
  })

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  )

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
          setSettings({
            theme: data.settings.theme || 'light',
            language: data.settings.language || 'es',
            timezone: data.settings.timezone || 'America/Guayaquil',
          })

          setNotificationPrefs({
            emailNotifications: data.settings.emailNotifications ?? true,
            pushNotifications: data.settings.pushNotifications ?? true,
            ticketUpdates: data.settings.ticketUpdates ?? true,
            systemAlerts: data.settings.systemAlerts ?? true,
            weeklyReport: data.settings.weeklyReport ?? false,
            soundEnabled: data.settings.soundEnabled ?? true,
            ticketCreated: data.settings.ticketCreated ?? true,
            ticketAssigned: data.settings.ticketAssigned ?? true,
            statusChanged: data.settings.statusChanged ?? true,
            newComments: data.settings.newComments ?? true,
            ticketUpdated: data.settings.ticketUpdated ?? true,
            quietHours: data.settings.quietHours || {
              enabled: false,
              startTime: '22:00',
              endTime: '08:00',
            },
          })
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveNotifications = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailNotifications: notificationPrefs.emailNotifications,
          pushNotifications: notificationPrefs.pushNotifications,
          ...settings,
        }),
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

  const handleSavePreferences = async () => {
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
    })
  }

  const updateNotificationPrefs = (updates: Partial<NotificationPreferences>) => {
    setNotificationPrefs(prev => ({ ...prev, ...updates }))
  }

  if (isLoading) {
    return (
      <RoleDashboardLayout title='Configuración' subtitle='Gestiona tus preferencias'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title='Configuración'
      subtitle='Gestiona tus preferencias y notificaciones'
    >
      <div className='max-w-4xl mx-auto space-y-6'>
        {/* Información del Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center'>
              <SettingsIcon className='h-5 w-5 mr-2 text-blue-600' />
              Información del Perfil
            </CardTitle>
            <CardDescription>Tu información personal y de contacto</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <Label>Nombre</Label>
              <div className='mt-1 p-2 bg-muted rounded-md text-sm'>
                {session?.user?.name || 'No disponible'}
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <div className='mt-1 p-2 bg-muted rounded-md text-sm'>
                {session?.user?.email || 'No disponible'}
              </div>
            </div>
            <p className='text-sm text-muted-foreground'>
              Para cambiar tu información personal, contacta al administrador
            </p>
          </CardContent>
        </Card>

        {/* Notificaciones - Componente Unificado Nivel Básico */}
        <NotificationSettingsUnified
          level='basic'
          preferences={notificationPrefs}
          onUpdate={updateNotificationPrefs}
          onSave={handleSaveNotifications}
          loading={isSaving}
        />

        {/* Preferencias */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center'>
              <Globe className='h-5 w-5 mr-2 text-purple-600' />
              Preferencias
            </CardTitle>
            <CardDescription>Personaliza tu experiencia en el sistema</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='space-y-2'>
              <Label htmlFor='language'>Idioma</Label>
              <Select
                value={settings?.language ?? 'es'}
                onValueChange={value => setSettings({ ...settings, language: value })}
              >
                <SelectTrigger id='language'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='es'>Español</SelectItem>
                  <SelectItem value='en'>English</SelectItem>
                  <SelectItem value='pt'>Português</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='timezone'>Zona Horaria</Label>
              <Select value='America/Guayaquil' disabled>
                <SelectTrigger id='timezone'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='America/Guayaquil'>Guayaquil, Ecuador (GMT-5)</SelectItem>
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>Sistema configurado para Ecuador</p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='theme'>Tema</Label>
              <Select
                value={settings?.theme ?? 'light'}
                onValueChange={value => setSettings({ ...settings, theme: value })}
              >
                <SelectTrigger id='theme'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='light'>Claro</SelectItem>
                  <SelectItem value='dark'>Oscuro</SelectItem>
                  <SelectItem value='system'>Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='flex items-center justify-end space-x-4 pt-4 border-t'>
              <Button variant='outline' onClick={handleReset} disabled={isSaving}>
                <RefreshCw className='h-4 w-4 mr-2' />
                Restaurar
              </Button>
              <Button onClick={handleSavePreferences} disabled={isSaving}>
                <Save className='h-4 w-4 mr-2' />
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
