'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PersonalSettings } from '@/components/settings/personal-settings'
import { NotificationSettingsCard } from '@/components/notifications/notification-settings-card'
import { useUserSettings } from '@/hooks/use-user-settings'
import type { NotificationPreferences } from '@/types/notification-preferences'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const { settings, updateSettings } = useUserSettings()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.push('/login')
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title='Configuración' subtitle='Personaliza tu experiencia'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600' />
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session) return null

  // Mapear UserSettings → NotificationPreferences para el card
  const notificationPrefs: NotificationPreferences = {
    emailNotifications: settings.emailNotifications,
    pushNotifications: settings.pushNotifications,
    soundEnabled: settings.soundEnabled,
    ticketUpdates: settings.ticketUpdates,
    systemAlerts: settings.systemAlerts,
    weeklyReport: settings.weeklyReport,
    ticketCreated: settings.ticketCreated,
    ticketAssigned: settings.ticketAssigned,
    statusChanged: settings.statusChanged,
    newComments: settings.newComments,
    ticketUpdated: settings.ticketUpdated,
    quietHours: settings.quietHours,
  }

  const handleNotificationUpdate = (updates: Partial<NotificationPreferences>) => {
    // Actualización local optimista vía el store global
    updateSettings(updates as any)
  }

  const handleNotificationSave = async () => {
    setSaving(true)
    const ok = await updateSettings(notificationPrefs as any)
    setSaving(false)
    if (ok) {
      toast({ title: 'Configuración guardada', description: 'Preferencias actualizadas' })
    } else {
      toast({ title: 'Error al guardar', variant: 'destructive' })
    }
  }

  const handlePersonalSave = async () => {
    setSaving(true)
    const ok = await updateSettings({
      theme: settings.theme,
      timezone: settings.timezone,
    })
    setSaving(false)
    if (ok) {
      toast({ title: 'Configuración guardada', description: 'Preferencias personales actualizadas' })
    } else {
      toast({ title: 'Error al guardar', variant: 'destructive' })
    }
  }

  const userRole = (session.user?.role || 'CLIENT') as 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
  const notificationLevel = userRole === 'CLIENT' ? 'intermediate' : 'advanced'

  return (
    <RoleDashboardLayout
      title='Configuración'
      subtitle='Personaliza tu experiencia y configuraciones del sistema'
    >
      <div className='max-w-6xl mx-auto'>
        <Tabs defaultValue='personal' className='space-y-6'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='personal'>Personal</TabsTrigger>
            <TabsTrigger value='notifications'>Notificaciones</TabsTrigger>
          </TabsList>

          <TabsContent value='personal' className='space-y-6'>
            <PersonalSettings onSave={handlePersonalSave} loading={saving} />
          </TabsContent>

          <TabsContent value='notifications' className='space-y-6'>
            <NotificationSettingsCard
              level={notificationLevel}
              preferences={notificationPrefs}
              onUpdate={handleNotificationUpdate}
              onSave={handleNotificationSave}
              loading={saving}
            />
          </TabsContent>
        </Tabs>
      </div>
    </RoleDashboardLayout>
  )
}
