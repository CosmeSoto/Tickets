'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
  Crown,
  Timer,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { OAuthSettingsTab } from '@/components/settings/oauth-settings-tab'
import { SLAPoliciesTab } from '@/components/settings/sla-policies-tab'

interface SystemSettings {
  // Configuración general
  systemName: string
  systemDescription: string
  supportEmail: string

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

  // Configuración de backups
  backupEnabled: boolean
  backupFrequency: 'daily' | 'weekly' | 'monthly'
  backupRetention: number
}

const SETTINGS_PAGE_SUBTITLE = 'Administra la configuración global del sistema de tickets'

function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(false)
  /** Evita un frame de “error” antes del primer fetch cuando ya hay sesión admin */
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'general')
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
  }, [session, status, router]) // eslint-disable-line react-hooks/exhaustive-deps

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
      setInitialFetchDone(true)
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
          description: error.details
            ? error.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(' | ')
            : error.error || 'Error al guardar configuración',
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
    if (!settings) return

    // Validar campos antes de enviar
    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
      toast({
        title: 'Campos incompletos',
        description: 'Completa el servidor SMTP, usuario y contraseña antes de probar.',
        variant: 'destructive',
      })
      return
    }

    try {
      const response = await fetch('/api/admin/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: settings.smtpHost,
          smtpPort: Number(settings.smtpPort),
          smtpUser: settings.smtpUser,
          smtpPassword: settings.smtpPassword,
          smtpSecure: settings.smtpSecure,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: 'Conexión exitosa',
          description: data.message || 'Email de prueba enviado correctamente',
        })
      } else {
        toast({
          title: 'Error de conexión SMTP',
          description: data.error || 'Error en la conexión de email',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error al probar email:', error)
      toast({
        title: 'Error',
        description: 'No se pudo conectar con el servidor. Verifica tu red.',
        variant: 'destructive',
      })
    }
  }

  if (status === 'loading') {
    return (
      <ModuleLayout title='Configuración del Sistema' subtitle={SETTINGS_PAGE_SUBTITLE} loading>
        {null}
      </ModuleLayout>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  const isSuperAdmin = (session.user as any).isSuperAdmin === true

  if (!settings && (!initialFetchDone || loading)) {
    return (
      <ModuleLayout title='Configuración del Sistema' subtitle={SETTINGS_PAGE_SUBTITLE} loading>
        {null}
      </ModuleLayout>
    )
  }

  if (!settings) {
    return (
      <ModuleLayout
        title='Configuración del Sistema'
        subtitle={SETTINGS_PAGE_SUBTITLE}
        error='No se pudo cargar la configuración. Comprueba tu conexión o permisos.'
        onRetry={loadSettings}
      >
        {null}
      </ModuleLayout>
    )
  }

  const headerActions = (
    <div className='flex flex-wrap items-center gap-2'>
      <Button variant='outline' onClick={loadSettings} disabled={loading}>
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Recargar
      </Button>
      {/* Solo mostrar botón guardar si NO estamos en la pestaña OAuth o SLA */}
      {activeTab !== 'oauth' && activeTab !== 'sla' && (
        <Button onClick={saveSettings} disabled={saving}>
          <Save className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      )}
    </div>
  )

  return (
    <ModuleLayout
      title='Configuración del Sistema'
      subtitle={SETTINGS_PAGE_SUBTITLE}
      headerActions={headerActions}
    >
      <Tabs
        value={activeTab}
        className='space-y-6'
        onValueChange={tab => {
          const superAdminTabs = ['email', 'security', 'oauth', 'sla']
          if (superAdminTabs.includes(tab) && !isSuperAdmin) return
          setActiveTab(tab)
        }}
      >
        <TabsList className='flex flex-wrap h-auto gap-1 p-1 w-full'>
          <TabsTrigger value='general' className='flex-1 min-w-[80px]'>
            General
          </TabsTrigger>
          <TabsTrigger value='notifications' className='flex-1 min-w-[110px]'>
            Notificaciones
          </TabsTrigger>
          {/* Tabs solo para Super Admin */}
          <TabsTrigger value='sla' className='flex-1 min-w-[60px]' disabled={!isSuperAdmin}>
            <span className='flex items-center gap-1'>
              {!isSuperAdmin && <Crown className='h-3 w-3 text-amber-500' />}
              <Timer className='h-4 w-4 hidden sm:inline' />
              <span className='hidden sm:inline'>SLA</span>
              <span className='sm:hidden'>SLA</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value='email' className='flex-1 min-w-[60px]' disabled={!isSuperAdmin}>
            <span className='flex items-center gap-1'>
              {!isSuperAdmin && <Crown className='h-3 w-3 text-amber-500' />}
              Email
            </span>
          </TabsTrigger>
          <TabsTrigger value='security' className='flex-1 min-w-[80px]' disabled={!isSuperAdmin}>
            <span className='flex items-center gap-1'>
              {!isSuperAdmin && <Crown className='h-3 w-3 text-amber-500' />}
              Seguridad
            </span>
          </TabsTrigger>
          <TabsTrigger value='oauth' className='flex-1 min-w-[70px]' disabled={!isSuperAdmin}>
            <span className='flex items-center gap-1'>
              {!isSuperAdmin && <Crown className='h-3 w-3 text-amber-500' />}
              <Key className='h-4 w-4 hidden sm:inline' />
              OAuth
            </span>
          </TabsTrigger>
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
                  <Label htmlFor='systemName' className='flex items-center gap-1.5'>
                    Nombre del Sistema
                    {!isSuperAdmin && (
                      <Crown className='h-3 w-3 text-amber-500' aria-label='Solo Super Admin' />
                    )}
                  </Label>
                  <Input
                    id='systemName'
                    value={settings.systemName}
                    onChange={e =>
                      isSuperAdmin && setSettings({ ...settings, systemName: e.target.value })
                    }
                    placeholder='Sistema de Tickets'
                    disabled={!isSuperAdmin}
                  />
                  {!isSuperAdmin && (
                    <p className='text-xs text-muted-foreground mt-1'>
                      Solo el Super Admin puede cambiar el nombre del sistema
                    </p>
                  )}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración de Email */}
        <TabsContent value='email'>
          {!isSuperAdmin ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <Crown className='h-12 w-12 text-amber-500 mb-4' />
              <h3 className='text-lg font-semibold text-foreground mb-2'>Acceso restringido</h3>
              <p className='text-muted-foreground max-w-sm'>
                Esta sección solo está disponible para Administradores Principales (Super Admin).
              </p>
            </div>
          ) : (
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
          )}
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
                Configuración global del sistema de notificaciones. Los usuarios pueden configurar
                sus preferencias personales en su perfil.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4'>
                <div className='flex items-start space-x-3'>
                  <Bell className='h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5' />
                  <div className='space-y-1'>
                    <h4 className='text-sm font-medium text-blue-900 dark:text-blue-200'>
                      Configuración Global
                    </h4>
                    <p className='text-sm text-blue-800 dark:text-blue-300'>
                      Esta configuración habilita o deshabilita el módulo de notificaciones para
                      todo el sistema. Cada usuario puede personalizar sus preferencias individuales
                      en Configuración → Notificaciones.
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
                  <div className='rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4'>
                    <div className='flex items-start space-x-3'>
                      <AlertTriangle className='h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5' />
                      <div className='space-y-1'>
                        <h4 className='text-sm font-medium text-amber-900 dark:text-amber-200'>
                          Notificaciones Deshabilitadas
                        </h4>
                        <p className='text-sm text-amber-700 dark:text-amber-300'>
                          Los usuarios no recibirán notificaciones del sistema. Esto puede afectar
                          la comunicación sobre tickets y actualizaciones importantes.
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
          {!isSuperAdmin ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <Crown className='h-12 w-12 text-amber-500 mb-4' />
              <h3 className='text-lg font-semibold text-foreground mb-2'>Acceso restringido</h3>
              <p className='text-muted-foreground max-w-sm'>
                Esta sección solo está disponible para Administradores Principales (Super Admin).
              </p>
            </div>
          ) : (
            <div className='space-y-6'>
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
                      <div className='space-y-2'>
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
                        <p className='text-sm text-muted-foreground'>
                          {settings.sessionTimeout < 60
                            ? `${settings.sessionTimeout} minutos`
                            : settings.sessionTimeout === 60
                              ? '1 hora'
                              : settings.sessionTimeout < 1440
                                ? `${Math.floor(settings.sessionTimeout / 60)} horas ${settings.sessionTimeout % 60 > 0 ? `y ${settings.sessionTimeout % 60} minutos` : ''}`
                                : '24 horas (1 día)'}
                        </p>
                        <p className='text-xs text-amber-600 dark:text-amber-400'>
                          ⚠️ La sesión se cerrará automáticamente después de este tiempo de
                          inactividad
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor='maxLoginAttempts'>Máximo Intentos de Login</Label>
                      <div className='space-y-2'>
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
                        <p className='text-sm text-muted-foreground'>
                          {settings.maxLoginAttempts} intentos antes de bloquear
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                      <Label htmlFor='passwordMinLength'>Longitud Mínima de Contraseña</Label>
                      <div className='space-y-2'>
                        <Input
                          id='passwordMinLength'
                          type='number'
                          value={settings.passwordMinLength}
                          onChange={e => {
                            const value = parseInt(e.target.value)
                            setSettings({
                              ...settings,
                              passwordMinLength: isNaN(value) ? 8 : value,
                            })
                          }}
                          min='6'
                          max='20'
                        />
                        <p className='text-sm text-muted-foreground'>
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
                    <div className='space-y-2'>
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
                      <p className='text-sm text-muted-foreground'>
                        Máximo {settings.maxFileSize} MB por archivo
                      </p>
                    </div>
                  </div>

                  {/* Información adicional sobre seguridad */}
                  <div className='mt-6 p-4 bg-muted border border-border rounded-lg'>
                    <h4 className='font-medium text-foreground mb-2'>
                      ℹ️ Información de Seguridad
                    </h4>
                    <ul className='text-sm text-muted-foreground space-y-1'>
                      <li>
                        • El cierre automático de sesión se activa después del tiempo configurado
                        sin actividad
                      </li>
                      <li>• Se mostrará una advertencia 5 minutos antes de cerrar la sesión</li>
                      <li>
                        • Cualquier acción del usuario (click, tecla, scroll) reinicia el contador
                      </li>
                      <li>• Los cambios requieren reiniciar sesión para aplicarse</li>
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
                  <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 bg-muted border border-border rounded-lg'>
                    <div className='min-w-0'>
                      <h4 className='font-medium text-foreground'>Sistema de Backups</h4>
                      <p className='text-sm text-muted-foreground mt-1'>
                        Accede al módulo completo de gestión de backups con configuración avanzada,
                        monitoreo en tiempo real y herramientas de restauración.
                      </p>
                    </div>
                    <Button
                      className='w-full sm:w-auto flex-shrink-0'
                      onClick={() => router.push('/admin/backups')}
                    >
                      <Database className='h-4 w-4 mr-2' />
                      Ir a Backups
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Configuración OAuth */}
        <TabsContent value='oauth'>
          {!isSuperAdmin ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <Crown className='h-12 w-12 text-amber-500 mb-4' />
              <h3 className='text-lg font-semibold text-foreground mb-2'>Acceso restringido</h3>
              <p className='text-muted-foreground max-w-sm'>
                Esta sección solo está disponible para Administradores Principales (Super Admin).
              </p>
            </div>
          ) : (
            <OAuthSettingsTab />
          )}
        </TabsContent>

        {/* Políticas SLA */}
        <TabsContent value='sla'>
          {!isSuperAdmin ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <Crown className='h-12 w-12 text-amber-500 mb-4' />
              <h3 className='text-lg font-semibold text-foreground mb-2'>Acceso restringido</h3>
              <p className='text-muted-foreground max-w-sm'>
                Esta sección solo está disponible para Administradores Principales (Super Admin).
              </p>
            </div>
          ) : (
            <SLAPoliciesTab isSuperAdmin={isSuperAdmin} />
          )}
        </TabsContent>
      </Tabs>
    </ModuleLayout>
  )
}

// Wrap in Suspense because useSearchParams requires it
function SettingsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary' />
        </div>
      }
    >
      <SettingsPage />
    </Suspense>
  )
}

export default SettingsPageWrapper
