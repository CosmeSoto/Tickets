'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PersonalSettings } from '@/components/settings/personal-settings'
import { PrivacySettings } from '@/components/settings/privacy-settings'
import { NotificationSettingsCard } from '@/components/notifications/notification-settings-card'
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationLevel,
} from '@/types/notification-preferences'

interface UserSettings {
  privacy: {
    profileVisible: boolean
    activityVisible: boolean
  }
  preferences: {
    theme: 'light' | 'dark' | 'system'
    timezone: string
  }
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [settings, setSettings] = useState<UserSettings>({
    privacy: {
      profileVisible: true,
      activityVisible: true,
    },
    preferences: {
      theme: 'light',
      timezone: 'America/Guayaquil',
    },
  })

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  )

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    loadUserSettings()
  }, [session, status, router])

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/user/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.settings) {
          setSettings({
            privacy: {
              profileVisible: true,
              activityVisible: true,
            },
            preferences: {
              theme: data.settings.theme || 'light',
              timezone: data.settings.timezone || 'America/Guayaquil',
            },
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
      console.error('Error loading user settings:', error)
    }
  }

  const saveNotificationSettings = async () => {
    setLoading(true)
    try {
      const payload = {
        emailNotifications: notificationPrefs.emailNotifications,
        pushNotifications: notificationPrefs.pushNotifications,
        ticketUpdates: notificationPrefs.ticketUpdates,
        systemAlerts: notificationPrefs.systemAlerts,
        weeklyReport: notificationPrefs.weeklyReport,
        soundEnabled: notificationPrefs.soundEnabled,
        ticketCreated: notificationPrefs.ticketCreated,
        ticketAssigned: notificationPrefs.ticketAssigned,
        statusChanged: notificationPrefs.statusChanged,
        newComments: notificationPrefs.newComments,
        ticketUpdated: notificationPrefs.ticketUpdated,
        quietHoursEnabled: notificationPrefs.quietHours.enabled,
        quietHoursStart: notificationPrefs.quietHours.startTime,
        quietHoursEnd: notificationPrefs.quietHours.endTime,
      }

      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast({
          title: 'Configuración guardada',
          description: 'Tus preferencias han sido actualizadas exitosamente',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Error al guardar',
          description: error.error || 'No se pudo guardar la configuración',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const updateNotificationPrefs = (updates: Partial<NotificationPreferences>) => {
    setNotificationPrefs(prev => ({ ...prev, ...updates }))
  }

  const updatePrivacySetting = (key: keyof UserSettings['privacy'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        [key]: value,
      },
    }))
  }

  const savePrivacySettings = async () => {
    setLoading(true)
    try {
      // Aquí iría la lógica para guardar configuraciones de privacidad
      toast({
        title: 'Configuración guardada',
        description: 'Tus preferencias de privacidad han sido actualizadas',
      })
    } catch (error) {
      console.error('Error saving privacy settings:', error)
      toast({
        title: 'Error al guardar',
        description: 'No se pudieron guardar las configuraciones de privacidad',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const savePersonalSettings = async () => {
    setLoading(true)
    try {
      const payload = {
        theme: settings.preferences.theme,
        timezone: settings.preferences.timezone,
      }

      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast({
          title: 'Configuración guardada',
          description: 'Tus preferencias personales han sido actualizadas',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Error al guardar',
          description: error.error || 'No se pudo guardar la configuración',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error saving personal settings:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title='Configuración' subtitle='Personaliza tu experiencia'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session) {
    return null
  }

  const isAdmin = session?.user?.role === 'ADMIN'
  const userRole = (session?.user?.role || 'CLIENT') as 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
  
  // Determinar nivel de notificaciones según rol
  // CLIENT: intermediate (email, push, ticket updates, comments, status changes)
  // TECHNICIAN/ADMIN: advanced (todas las opciones incluyendo granulares y horarios)
  const notificationLevel = userRole === 'CLIENT' ? 'intermediate' : 'advanced'

  return (
    <RoleDashboardLayout
      title='Configuración'
      subtitle='Personaliza tu experiencia y configuraciones del sistema'
    >
      <div className='max-w-6xl mx-auto'>
        <Tabs defaultValue='personal' className='space-y-6'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='personal'>Personal</TabsTrigger>
            <TabsTrigger value='notifications'>Notificaciones</TabsTrigger>
            <TabsTrigger value='privacy'>Privacidad</TabsTrigger>
          </TabsList>

          {/* Configuración Personal */}
          <TabsContent value='personal' className='space-y-6'>
            <PersonalSettings onSave={savePersonalSettings} loading={loading} />
          </TabsContent>

          {/* Notificaciones - Nivel según rol del usuario */}
          <TabsContent value='notifications' className='space-y-6'>
            <NotificationSettingsCard
              level={notificationLevel}
              preferences={notificationPrefs}
              onUpdate={updateNotificationPrefs}
              onSave={saveNotificationSettings}
              loading={loading}
            />
          </TabsContent>

          {/* Privacidad */}
          <TabsContent value='privacy' className='space-y-6'>
            <PrivacySettings
              settings={settings}
              onUpdateSetting={updatePrivacySetting}
              onSave={savePrivacySettings}
              loading={loading}
              isAdmin={isAdmin}
              userRole={userRole}
            />
          </TabsContent>
        </Tabs>
      </div>
    </RoleDashboardLayout>
  )
}
