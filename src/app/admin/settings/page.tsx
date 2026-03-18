'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Settings,
  Mail,
  Shield,
  Database,
  Bell,
  Save,
  RefreshCw,
  AlertTriangle,
  Key,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { OAuthSettingsTab } from '@/components/settings/oauth-settings-tab'
import { LandingPageCMSTab } from '@/components/settings/landing-page-cms-tab'

interface SystemSettings {
  // Configuración general
  systemName: string
  systemDescription: string
  supportEmail: string
  maxTicketsPerUser: number
  autoAssignmentEnabled: boolean

  // Configuración de email
  emailEnabled: boolean
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  smtpSecure: boolean
  emailFrom: string

  // Configuración de notificaciones
  notificationsEnabled: boolean
  emailNotifications: boolean
  browserNotifications: boolean

  // Configuración de seguridad
  sessionTimeout: number
  maxLoginAttempts: number
  passwordMinLength: number
  requirePasswordChange: boolean

  // Configuración de archivos
  maxFileSize: number
  allowedFileTypes: string[]

  // Configuración de auto-cierre de tickets
  autoCloseDays: number

  // Configuración de backups
  backupEnabled: boolean
  backupFrequency: 'daily' | 'weekly' | 'monthly'
  backupRetention: number
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')
  const { toast } = useToast()

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'ADMIN') {
      router.push('/login')
      return
    }

    loadSettings()
  }, [session, status, router])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      } else {
        toast({
          title: 'Error',
          description: 'Error al cargar configuración',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error)
      toast({
        title: 'Error',
        description: 'Error al cargar configuración',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Configuración guardada correctamente',
        })
        // Notificar a componentes que escuchan cambios de configuración (ej: session timeout monitor)
        window.dispatchEvent(new CustomEvent('settings-updated'))
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Error al guardar configuración',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error al guardar configuración:', error)
      toast({
        title: 'Error',
        description: 'Error al guardar configuración',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const testEmailConnection = async () => {
    try {
      const response = await fetch('/api/admin/settings/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          smtpHost: settings?.smtpHost,
          smtpPort: settings?.smtpPort,
          smtpUser: settings?.smtpUser,
          smtpPassword: settings?.smtpPassword,
          smtpSecure: settings?.smtpSecure,
        }),
      })

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Conexión de email configurada correctamente',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Error en la conexión de email',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error al probar email:', error)
      toast({
        title: 'Error',
        description: 'Error al probar conexión de email',
        variant: 'destructive',
      })
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
          <p className='mt-2 text-muted-foreground'>Cargando configuración...</p>
        </div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  if (!settings) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-center'>
          <AlertTriangle className='h-8 w-8 text-red-500 mx-auto mb-2' />
          <p className='text-muted-foreground'>Error al cargar la configuración</p>
          <Button onClick={loadSettings} className='mt-2'>
            <RefreshCw className='h-4 w-4 mr-2' />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const headerActions = (
    <div className='flex items-center space-x-2'>
      <Button variant='outline' onClick={loadSettings} disabled={loading}>
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Recargar
      </Button>
      {/* Solo mostrar botón guardar si NO estamos en la pestaña OAuth o Landing */}
      {activeTab !== 'oauth' && activeTab !== 'landing' && (
        <Button onClick={saveSettings} disabled={saving}>
          <Save className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      )}
    </div>
  )

  return (
    <RoleDashboardLayout
      title='Configuración del Sistema'
      subtitle='Administra la configuración global del sistema de tickets'
      headerActions={headerActions}
    >
      <Tabs value={activeTab} className='space-y-6' onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-6'>
          <TabsTrigger value='general'>General</TabsTrigger>
          <TabsTrigger value='email'>Email</TabsTrigger>
          <TabsTrigger value='notifications'>Notificaciones</TabsTrigger>
          <TabsTrigger value='security'>Seguridad</TabsTrigger>
          <TabsTrigger value='oauth'>
            <Key className="h-4 w-4 mr-2" />
            OAuth
          </TabsTrigger>
          <TabsTrigger value='landing'>Página Pública</TabsTrigger>
        </TabsList>

        {/* Configuración General */}
        <TabsContent value='general'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Settings className='h-5 w-5 mr-2' />
                Configuración General
              </CardTitle>
              <CardDescription>Configuración básica del sistema de tickets</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <Label htmlFor='systemName'>Nombre del Sistema</Label>
                  <Input
                    id='systemName'
                    value={settings.systemName}
                    onChange={e => setSettings({ ...settings, systemName: e.target.value })}
                    placeholder='Sistema de Tickets'
                  />
                </div>
                <div>
                  <Label htmlFor='supportEmail'>Email de Soporte</Label>
                  <Input
                    id='supportEmail'
                    type='email'
                    value={settings.supportEmail}
                    onChange={e => setSettings({ ...settings, supportEmail: e.target.value })}
                    placeholder='soporte@empresa.com'
                  />
                </div>
              </div>

              <div>
                <Label htmlFor='systemDescription'>Descripción del Sistema</Label>
                <Textarea
                  id='systemDescription'
                  value={settings.systemDescription}
                  onChange={e => setSettings({ ...settings, systemDescription: e.target.value })}
                  placeholder='Sistema de gestión de tickets de soporte técnico'
                  rows={3}
                />
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <Label htmlFor='maxTicketsPerUser'>Máximo Tickets por Usuario</Label>
                  <Input
                    id='maxTicketsPerUser'
                    type='number'
                    value={settings.maxTicketsPerUser}
                    onChange={e => {
                      const value = parseInt(e.target.value)
                      setSettings({ ...settings, maxTicketsPerUser: isNaN(value) ? 10 : value })
                    }}
                    min='1'
                    max='100'
                  />
                </div>
                <div className='flex items-center space-x-2 pt-6'>
                  <Switch
                    id='autoAssignment'
                    checked={settings.autoAssignmentEnabled}
                    onCheckedChange={checked =>
                      setSettings({ ...settings, autoAssignmentEnabled: checked })
                    }
                  />
                  <Label htmlFor='autoAssignment'>Asignación Automática Habilitada</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración de Email */}
        <TabsContent value='email'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Mail className='h-5 w-5 mr-2' />
                Configuración de Email
              </CardTitle>
              <CardDescription>
                Configuración del servidor SMTP para envío de emails
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center space-x-2'>
                <Switch
                  id='emailEnabled'
                  checked={settings.emailEnabled}
                  onCheckedChange={checked => setSettings({ ...settings, emailEnabled: checked })}
                />
                <Label htmlFor='emailEnabled'>Habilitar envío de emails</Label>
              </div>

              {settings.emailEnabled && (
                <>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                      <Label htmlFor='smtpHost'>Servidor SMTP</Label>
                      <Input
                        id='smtpHost'
                        value={settings.smtpHost}
                        onChange={e => setSettings({ ...settings, smtpHost: e.target.value })}
                        placeholder='smtp.gmail.com'
                      />
                    </div>
                    <div>
                      <Label htmlFor='smtpPort'>Puerto SMTP</Label>
                      <Input
                        id='smtpPort'
                        type='number'
                        value={settings.smtpPort}
                        onChange={e => {
                          const value = parseInt(e.target.value)
                          setSettings({ ...settings, smtpPort: isNaN(value) ? 587 : value })
                        }}
                        placeholder='587'
                      />
                    </div>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                      <Label htmlFor='smtpUser'>Usuario SMTP</Label>
                      <Input
                        id='smtpUser'
                        value={settings.smtpUser}
                        onChange={e => setSettings({ ...settings, smtpUser: e.target.value })}
                        placeholder='usuario@gmail.com'
                      />
                    </div>
                    <div>
                      <Label htmlFor='smtpPassword'>Contraseña SMTP</Label>
                      <Input
                        id='smtpPassword'
                        type='password'
                        value={settings.smtpPassword}
                        onChange={e => setSettings({ ...settings, smtpPassword: e.target.value })}
                        placeholder='••••••••'
                      />
                    </div>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                      <Label htmlFor='emailFrom'>Email Remitente</Label>
                      <Input
                        id='emailFrom'
                        type='email'
                        value={settings.emailFrom}
                        onChange={e => setSettings({ ...settings, emailFrom: e.target.value })}
                        placeholder='noreply@empresa.com'
                      />
                    </div>
                    <div className='flex items-center space-x-2 pt-6'>
                      <Switch
                        id='smtpSecure'
                        checked={settings.smtpSecure}
                        onCheckedChange={checked =>
                          setSettings({ ...settings, smtpSecure: checked })
                        }
                      />
                      <Label htmlFor='smtpSecure'>Conexión Segura (SSL/TLS)</Label>
                    </div>
                  </div>

                  <div className='pt-4'>
                    <Button variant='outline' onClick={testEmailConnection}>
                      <Mail className='h-4 w-4 mr-2' />
                      Probar Conexión
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración de Notificaciones */}
        <TabsContent value='notifications'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Bell className='h-5 w-5 mr-2' />
                Módulo de Notificaciones
              </CardTitle>
              <CardDescription>
                Configuración global del sistema de notificaciones. 
                Los usuarios pueden configurar sus preferencias personales en su perfil.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
                <div className='flex items-start space-x-3'>
                  <Bell className='h-5 w-5 text-blue-600 mt-0.5' />
                  <div className='space-y-1'>
                    <h4 className='text-sm font-medium text-blue-900'>
                      Configuración Global
                    </h4>
                    <p className='text-sm text-blue-700'>
                      Esta configuración habilita o deshabilita el módulo de notificaciones para todo el sistema.
                      Cada usuario puede personalizar sus preferencias individuales en Configuración → Notificaciones.
                    </p>
                  </div>
                </div>
              </div>

              <div className='space-y-4'>
                <div className='flex items-center justify-between p-4 border rounded-lg'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='notificationsEnabled' className='text-base font-medium'>
                      Habilitar Sistema de Notificaciones
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Activa o desactiva el módulo de notificaciones para todos los usuarios
                    </p>
                  </div>
                  <Switch
                    id='notificationsEnabled'
                    checked={settings.notificationsEnabled}
                    onCheckedChange={checked =>
                      setSettings({ ...settings, notificationsEnabled: checked })
                    }
                  />
                </div>

                {!settings.notificationsEnabled && (
                  <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
                    <div className='flex items-start space-x-3'>
                      <AlertTriangle className='h-5 w-5 text-yellow-600 mt-0.5' />
                      <div className='space-y-1'>
                        <h4 className='text-sm font-medium text-yellow-900'>
                          Notificaciones Deshabilitadas
                        </h4>
                        <p className='text-sm text-yellow-700'>
                          Los usuarios no recibirán notificaciones del sistema. 
                          Esto puede afectar la comunicación sobre tickets y actualizaciones importantes.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración de Seguridad */}
        <TabsContent value='security'>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center'>
                  <Shield className='h-5 w-5 mr-2' />
                  Configuración de Seguridad
                </CardTitle>
                <CardDescription>Configuración de seguridad y autenticación</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='sessionTimeout'>Tiempo de Sesión</Label>
                    <div className="space-y-2">
                      <Input
                        id='sessionTimeout'
                        type='number'
                        value={settings.sessionTimeout}
                        onChange={e => {
                          const value = parseInt(e.target.value)
                          setSettings({ ...settings, sessionTimeout: isNaN(value) ? 30 : value })
                        }}
                        min='5'
                        max='1440'
                      />
                      <p className="text-sm text-muted-foreground">
                        {settings.sessionTimeout < 60 
                          ? `${settings.sessionTimeout} minutos`
                          : settings.sessionTimeout === 60
                          ? '1 hora'
                          : settings.sessionTimeout < 1440
                          ? `${Math.floor(settings.sessionTimeout / 60)} horas ${settings.sessionTimeout % 60 > 0 ? `y ${settings.sessionTimeout % 60} minutos` : ''}`
                          : '24 horas (1 día)'
                        }
                      </p>
                      <p className="text-xs text-amber-600">
                        ⚠️ La sesión se cerrará automáticamente después de este tiempo de inactividad
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor='maxLoginAttempts'>Máximo Intentos de Login</Label>
                    <div className="space-y-2">
                      <Input
                        id='maxLoginAttempts'
                        type='number'
                        value={settings.maxLoginAttempts}
                        onChange={e => {
                          const value = parseInt(e.target.value)
                          setSettings({ ...settings, maxLoginAttempts: isNaN(value) ? 5 : value })
                        }}
                        min='3'
                        max='10'
                      />
                      <p className="text-sm text-muted-foreground">
                        {settings.maxLoginAttempts} intentos antes de bloquear
                      </p>
                    </div>
                  </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='passwordMinLength'>Longitud Mínima de Contraseña</Label>
                    <div className="space-y-2">
                      <Input
                        id='passwordMinLength'
                        type='number'
                        value={settings.passwordMinLength}
                        onChange={e => {
                          const value = parseInt(e.target.value)
                          setSettings({ ...settings, passwordMinLength: isNaN(value) ? 8 : value })
                        }}
                        min='6'
                        max='20'
                      />
                      <p className="text-sm text-muted-foreground">
                        Mínimo {settings.passwordMinLength} caracteres
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center space-x-2 pt-6'>
                    <Switch
                      id='requirePasswordChange'
                      checked={settings.requirePasswordChange}
                      onCheckedChange={checked =>
                        setSettings({ ...settings, requirePasswordChange: checked })
                      }
                    />
                    <Label htmlFor='requirePasswordChange'>Requerir cambio de contraseña</Label>
                  </div>
                </div>

                <div>
                  <Label htmlFor='maxFileSize'>Tamaño Máximo de Archivo</Label>
                  <div className="space-y-2">
                    <Input
                      id='maxFileSize'
                      type='number'
                      value={settings.maxFileSize}
                      onChange={e => {
                        const value = parseInt(e.target.value)
                        setSettings({ ...settings, maxFileSize: isNaN(value) ? 10 : value })
                      }}
                      min='1'
                      max='100'
                    />
                    <p className="text-sm text-muted-foreground">
                      Máximo {settings.maxFileSize} MB por archivo
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor='autoCloseDays'>Auto-cierre de Tickets Resueltos</Label>
                  <div className="space-y-2">
                    <Input
                      id='autoCloseDays'
                      type='number'
                      value={settings.autoCloseDays}
                      onChange={e => {
                        const value = parseInt(e.target.value)
                        setSettings({ ...settings, autoCloseDays: isNaN(value) ? 3 : value })
                      }}
                      min='1'
                      max='30'
                    />
                    <p className="text-sm text-muted-foreground">
                      {settings.autoCloseDays === 1
                        ? '1 día para que el cliente califique'
                        : `${settings.autoCloseDays} días para que el cliente califique`
                      }
                    </p>
                    <p className="text-xs text-amber-600">
                      ⚠️ Los tickets resueltos se cerrarán automáticamente si el cliente no califica dentro de este plazo
                    </p>
                  </div>
                </div>

                {/* Información adicional sobre seguridad */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">ℹ️ Información de Seguridad</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• El cierre automático de sesión se activa después del tiempo configurado sin actividad</li>
                    <li>• Se mostrará una advertencia 5 minutos antes de cerrar la sesión</li>
                    <li>• Cualquier acción del usuario (click, tecla, scroll) reinicia el contador</li>
                    <li>• Los cambios requieren reiniciar sesión para aplicarse</li>
                    <li>• Los tickets resueltos sin calificación se cierran automáticamente según el plazo configurado</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Enlace al módulo de backups */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center'>
                  <Database className='h-5 w-5 mr-2' />
                  Gestión de Backups
                </CardTitle>
                <CardDescription>
                  La configuración de backups se ha movido a un módulo dedicado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-blue-900">Sistema de Backups</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Accede al módulo completo de gestión de backups con configuración avanzada, 
                      monitoreo en tiempo real y herramientas de restauración.
                    </p>
                  </div>
                  <Button 
                    onClick={() => router.push('/admin/backups')}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Ir a Backups
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Configuración OAuth */}
        <TabsContent value='oauth'>
          <OAuthSettingsTab />
        </TabsContent>

        {/* Página Pública CMS */}
        <TabsContent value='landing'>
          <LandingPageCMSTab />
        </TabsContent>
      </Tabs>
    </RoleDashboardLayout>
  )
}
