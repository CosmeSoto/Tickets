'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Componentes de configuración
import { PersonalSettings } from '@/components/settings/personal-settings'
import { NotificationSettings } from '@/components/settings/notification-settings'
import { PrivacySettings } from '@/components/settings/privacy-settings'

interface UserSettings {
  notifications: {
    email: boolean
    push: boolean
    ticketUpdates: boolean
    systemAlerts: boolean
    weeklyReport: boolean
  }
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
    notifications: {
      email: true,
      push: true,
      ticketUpdates: true,
      systemAlerts: true,
      weeklyReport: false
    },
    privacy: {
      profileVisible: true,
      activityVisible: true
    },
    preferences: {
      theme: 'light',
      timezone: 'America/Guayaquil'
    }
  })

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
          // Mapear de user_settings a la estructura esperada
          setSettings({
            notifications: {
              email: data.settings.emailNotifications ?? true,
              push: data.settings.pushNotifications ?? true,
              ticketUpdates: data.settings.emailNotifications ?? true,
              systemAlerts: true,
              weeklyReport: false
            },
            privacy: {
              profileVisible: true,
              activityVisible: true
            },
            preferences: {
              theme: data.settings.theme || 'light',
              timezone: data.settings.timezone || 'America/Guayaquil'
            }
          })
        }
      }
    } catch (error) {
      console.error('Error loading user settings:', error)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      // Mapear de estructura UI a user_settings
      const payload = {
        emailNotifications: settings.notifications.email,
        pushNotifications: settings.notifications.push,
        theme: settings.preferences.theme,
        timezone: settings.preferences.timezone
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

  const updateNotificationSetting = (key: keyof UserSettings['notifications'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }))
  }

  const updatePrivacySetting = (key: keyof UserSettings['privacy'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        [key]: value
      }
    }))
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
            <PersonalSettings onSave={saveSettings} loading={loading} />
          </TabsContent>

          {/* Notificaciones */}
          <TabsContent value='notifications' className='space-y-6'>
            <NotificationSettings 
              settings={settings}
              onUpdateSetting={updateNotificationSetting}
              onSave={saveSettings}
              loading={loading}
            />
          </TabsContent>

          {/* Privacidad */}
          <TabsContent value='privacy' className='space-y-6'>
            <PrivacySettings 
              settings={settings}
              onUpdateSetting={updatePrivacySetting}
              onSave={saveSettings}
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