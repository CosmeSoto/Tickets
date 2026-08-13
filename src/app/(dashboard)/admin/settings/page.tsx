'use client'

// NOTA: La configuración de la "Página Pública" YA EXISTE en su propia página
// en el sidebar: /admin/help-config, NO ES NECESARIO AGREGARLA AQUÍ
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Send,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Inbox,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { invalidateLandingCache } from '@/hooks/use-landing-data'
import { validateEnabledEmailSettings } from '@/lib/email/smtp-settings-validation'
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
  passwordChangeIntervalDays: number

  // Configuración de archivos
  maxFileSize: number
  allowedFileTypes: string[]

  // Solo lectura desde API
  smtpPasswordConfigured?: boolean

  // Configuración de backups
  backupEnabled: boolean
  backupFrequency: 'daily' | 'weekly' | 'monthly'
  backupRetention: number

  // Configuración de Telegram Bot
  telegramEnabled: boolean
  telegramBotToken: string
  telegramBotUsername: string
  telegramWebhookSecret: string
  telegramNotificationsEnabled: boolean
  // Solo lectura desde API
  telegramBotTokenConfigured?: boolean
  telegramWebhookSecretConfigured?: boolean
}

const SETTINGS_PAGE_SUBTITLE = 'Administra la configuración global del sistema de tickets'

function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isSuperAdmin = (session?.user as { isSuperAdmin?: boolean } | undefined)?.isSuperAdmin === true
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(false)
  /** Evita un frame de “error” antes del primer fetch cuando ya hay sesión admin */
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'general')
  const { toast } = useToast()
  // Estado UI de cola de email
  const [emailQueueStats, setEmailQueueStats] = useState<{
    pending: number
    failed: number
  } | null>(null)
  const [emailQueueLoading, setEmailQueueLoading] = useState(false)
  const [emailQueueProcessing, setEmailQueueProcessing] = useState(false)
  // Estado UI de Telegram (testing, webhook, visibilidad de campos sensibles)
  const [telegramTesting, setTelegramTesting] = useState(false)
  const [telegramBotInfo, setTelegramBotInfo] = useState<{
    id: number
    username: string
    firstName: string
  } | null>(null)
  const [registeringWebhook, setRegisteringWebhook] = useState(false)
  const [showBotToken, setShowBotToken] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)
  const [telegramQueueStats, setTelegramQueueStats] = useState<{
    pending: number
    failed: number
    sending: number
  } | null>(null)
  const [telegramQueueRecent, setTelegramQueueRecent] = useState<{
    sent: Array<{
      id: string
      title: string
      module: string | null
      priority: string
      sentAt: string | null
      attempts: number
    }>
    failed: Array<{
      id: string
      title: string
      module: string | null
      priority: string
      scheduledAt: string
      attempts: number
      maxAttempts: number
      errorMessage: string | null
    }>
  } | null>(null)
  const [telegramQueueLoading, setTelegramQueueLoading] = useState(false)
  const [telegramQueueProcessing, setTelegramQueueProcessing] = useState(false)

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
        setSettings({
          ...data,
          smtpPassword: '',
          smtpPort: data.smtpPort === 25 ? 587 : (data.smtpPort ?? 587),
          // Los tokens sensibles llegan vacíos — la API solo devuelve el flag *Configured
          telegramBotToken: '',
          telegramWebhookSecret: '',
          telegramEnabled: data.telegramEnabled ?? false,
          telegramBotUsername: data.telegramBotUsername ?? '',
          telegramNotificationsEnabled: data.telegramNotificationsEnabled ?? true,
        })
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

    if (settings.emailEnabled) {
      const emailError = validateEnabledEmailSettings({
        smtpHost: settings.smtpHost,
        smtpUser: settings.smtpUser,
        smtpPassword: settings.smtpPassword,
        hasStoredPassword: settings.smtpPasswordConfigured,
      })
      if (emailError) {
        toast({
          title: 'Configuración de email incompleta',
          description: emailError,
          variant: 'destructive',
        })
        return
      }
    }

    setSaving(true)
    try {
      const { smtpPassword, telegramBotToken, telegramWebhookSecret, ...rest } = settings
      const payload: Record<string, unknown> = { ...rest }
      if (smtpPassword?.trim()) {
        payload.smtpPassword = smtpPassword
      }
      // Solo enviar tokens Telegram si el admin escribió un nuevo valor
      if (telegramBotToken?.trim()) {
        payload.telegramBotToken = telegramBotToken
      }
      if (telegramWebhookSecret?.trim()) {
        payload.telegramWebhookSecret = telegramWebhookSecret
      }
      // Resetear bot info al guardar (podría cambiar el token)
      setTelegramBotInfo(null)

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Configuración guardada correctamente',
        })
        invalidateLandingCache()
        await loadSettings()
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
    if (!settings.smtpHost || !settings.smtpUser) {
      toast({
        title: 'Campos incompletos',
        description: 'Completa el servidor SMTP y usuario antes de probar.',
        variant: 'destructive',
      })
      return
    }

    if (!settings.smtpPassword && !settings.smtpPasswordConfigured) {
      toast({
        title: 'Contraseña requerida',
        description: 'Escribe la contraseña SMTP o guárdala primero en la configuración.',
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
          ...(settings.smtpPassword?.trim()
            ? { smtpPassword: settings.smtpPassword }
            : {}),
          smtpSecure: settings.smtpSecure,
          emailFrom: settings.emailFrom,
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

  const loadEmailQueue = async () => {
    setEmailQueueLoading(true)
    try {
      const res = await fetch('/api/admin/settings/email-queue')
      const data = await res.json()
      if (data.success) {
        setEmailQueueStats(data.stats)
      }
    } catch {
      // silencioso — no interrumpir la carga general
    } finally {
      setEmailQueueLoading(false)
    }
  }

  const processEmailQueue = async (retryFailed = false) => {
    setEmailQueueProcessing(true)
    try {
      const res = await fetch('/api/admin/settings/email-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retryFailed }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Cola procesada', description: data.message })
        await loadEmailQueue()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({
        title: 'Error de red',
        description: 'No se pudo conectar con el servidor.',
        variant: 'destructive',
      })
    } finally {
      setEmailQueueProcessing(false)
    }
  }

  const loadTelegramQueue = async () => {
    setTelegramQueueLoading(true)
    try {
      const res = await fetch('/api/admin/settings/telegram-queue')
      const data = await res.json()
      if (data.success) {
        setTelegramQueueStats(data.stats)
        setTelegramQueueRecent({
          sent: data.recentSent ?? [],
          failed: data.recentFailed ?? [],
        })
      }
    } catch {
      // silencioso
    } finally {
      setTelegramQueueLoading(false)
    }
  }

  const processTelegramQueue = async (retryFailed = false) => {
    setTelegramQueueProcessing(true)
    try {
      const res = await fetch('/api/admin/settings/telegram-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retryFailed, purgeOld: true }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Cola Telegram procesada', description: data.message })
        await loadTelegramQueue()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({
        title: 'Error de red',
        description: 'No se pudo conectar con el servidor.',
        variant: 'destructive',
      })
    } finally {
      setTelegramQueueProcessing(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'telegram' && settings?.telegramEnabled && isSuperAdmin) {
      void loadTelegramQueue()
    }
  }, [activeTab, settings?.telegramEnabled, isSuperAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const testTelegramConnection = async () => {
    if (!settings) return
    const token = settings.telegramBotToken?.trim()
    if (!token) {
      toast({
        title: 'Token requerido',
        description: 'Escribe el token del bot antes de probar la conexión.',
        variant: 'destructive',
      })
      return
    }
    setTelegramTesting(true)
    setTelegramBotInfo(null)
    try {
      const res = await fetch('/api/admin/settings/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: token }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTelegramBotInfo(data.bot)
        toast({
          title: 'Bot verificado',
          description: `@${data.bot.username} (${data.bot.firstName}) conectado correctamente.`,
        })
      } else {
        toast({
          title: 'Token inválido',
          description: data.error || 'No se pudo conectar con la Bot API de Telegram.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error de red',
        description: 'No se pudo conectar con el servidor.',
        variant: 'destructive',
      })
    } finally {
      setTelegramTesting(false)
    }
  }

  const registerTelegramWebhook = async () => {
    if (!settings) return

    // Detectar URL local/privada antes de intentar el registro
    const appUrl = window.location.origin
    const isLocal =
      appUrl.includes('localhost') ||
      appUrl.includes('127.0.0.1') ||
      /https?:\/\/192\.168\.\d+\.\d+/.test(appUrl) ||
      /https?:\/\/10\.\d+\.\d+\.\d+/.test(appUrl) ||
      /https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/.test(appUrl)

    if (isLocal) {
      toast({
        title: 'URL local detectada',
        description:
          'Telegram no acepta IPs privadas. Usa el cron de polling mientras estés en red local. ' +
          'El webhook funcionará cuando tengas un dominio público.',
        variant: 'destructive',
      })
      return
    }

    const hasWebhookSecret =
      settings.telegramWebhookSecretConfigured || Boolean(settings.telegramWebhookSecret?.trim())
    if (!hasWebhookSecret) {
      toast({
        title: 'Webhook Secret requerido',
        description:
          'Configura y guarda un Webhook Secret antes de registrar el webhook. En producción el bot rechazará updates sin él.',
        variant: 'destructive',
      })
      return
    }

    setRegisteringWebhook(true)
    try {
      const body: Record<string, unknown> = {}
      if (settings.telegramBotToken?.trim()) body.botToken = settings.telegramBotToken.trim()
      const res = await fetch('/api/telegram/register-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({
          title: 'Webhook registrado',
          description: `URL: ${data.webhookUrl}`,
        })
      } else {
        toast({
          title: 'Error al registrar webhook',
          description: data.error || 'No se pudo registrar el webhook.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error de red',
        description: 'No se pudo conectar con el servidor.',
        variant: 'destructive',
      })
    } finally {
      setRegisteringWebhook(false)
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
      {activeTab !== 'oauth' && activeTab !== 'sla' && isSuperAdmin && (
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
          const superAdminTabs = ['email', 'security', 'oauth', 'sla', 'telegram']
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
          <TabsTrigger value='telegram' className='flex-1 min-w-[80px]' disabled={!isSuperAdmin}>
            <span className='flex items-center gap-1'>
              {!isSuperAdmin && <Crown className='h-3 w-3 text-amber-500' />}
              <Send className='h-4 w-4 hidden sm:inline' />
              <span>Telegram</span>
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
                    placeholder='Gestión Operaciones'
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
                    onChange={e =>
                      isSuperAdmin && setSettings({ ...settings, supportEmail: e.target.value })
                    }
                    placeholder='soporte@empresa.com'
                    disabled={!isSuperAdmin}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor='systemDescription'>Descripción del Sistema</Label>
                <Textarea
                  id='systemDescription'
                  value={settings.systemDescription}
                  onChange={e =>
                    isSuperAdmin && setSettings({ ...settings, systemDescription: e.target.value })
                  }
                  placeholder='Soporte profesional para toda la organización'
                  rows={3}
                  disabled={!isSuperAdmin}
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
                    {/* Selector de proveedor */}
                    <div className='rounded-lg border border-border bg-muted/40 p-4 space-y-3'>
                      <div>
                        <Label className='text-sm font-medium'>Proveedor de correo</Label>
                        <p className='text-xs text-muted-foreground mt-0.5'>
                          Selecciona tu proveedor para autocompletar la configuración del servidor
                        </p>
                      </div>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                        {[
                          {
                            id: 'outlook',
                            label: 'Microsoft (Outlook / M365)',
                            description:
                              'Outlook.com, Hotmail y cuentas corporativas Microsoft 365',
                            host: 'smtp-mail.outlook.com',
                            port: 587,
                            secure: false,
                          },
                          {
                            id: 'gmail',
                            label: 'Gmail / Google Workspace',
                            description: 'gmail.com y dominios de Google Workspace',
                            host: 'smtp.gmail.com',
                            port: 587,
                            secure: false,
                          },
                        ].map(provider => {
                          const isActive =
                            provider.id === 'gmail'
                              ? settings.smtpHost === 'smtp.gmail.com'
                              : settings.smtpHost === 'smtp-mail.outlook.com' ||
                                settings.smtpHost === 'smtp.office365.com'
                          return (
                            <button
                              key={provider.id}
                              type='button'
                              onClick={() => {
                                setSettings({
                                  ...settings,
                                  smtpHost: provider.host,
                                  smtpPort: provider.port,
                                  smtpSecure: provider.secure,
                                  emailFrom: settings.emailFrom?.trim()
                                    ? settings.emailFrom
                                    : settings.smtpUser?.trim() || '',
                                })
                              }}
                              className={`text-left rounded-md border p-3 transition-colors ${
                                isActive
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/60'
                              }`}
                            >
                              <p className='text-sm font-medium leading-none'>{provider.label}</p>
                              <p className='text-xs text-muted-foreground mt-1 leading-snug'>
                                {provider.description}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Servidor y puerto */}
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      <div className='space-y-1.5'>
                        <Label htmlFor='smtpHost'>Servidor SMTP</Label>
                        <Input
                          id='smtpHost'
                          value={settings.smtpHost}
                          onChange={e => setSettings({ ...settings, smtpHost: e.target.value })}
                          placeholder='smtp-mail.outlook.com'
                        />
                        <p className='text-xs text-muted-foreground'>
                          Outlook personal:{' '}
                          <code className='font-mono text-[11px]'>smtp-mail.outlook.com</code>
                          {' · '}
                          Microsoft 365:{' '}
                          <code className='font-mono text-[11px]'>smtp.office365.com</code>
                        </p>
                        {(settings.smtpHost === 'smtp-mail.outlook.com' ||
                          settings.smtpHost === 'smtp.office365.com') && (
                          <button
                            type='button'
                            className='text-xs text-primary underline-offset-2 hover:underline'
                            onClick={() =>
                              setSettings({
                                ...settings,
                                smtpHost:
                                  settings.smtpHost === 'smtp.office365.com'
                                    ? 'smtp-mail.outlook.com'
                                    : 'smtp.office365.com',
                              })
                            }
                          >
                            Cambiar a{' '}
                            {settings.smtpHost === 'smtp.office365.com'
                              ? 'smtp-mail.outlook.com (Outlook personal)'
                              : 'smtp.office365.com (Microsoft 365)'}
                          </button>
                        )}
                      </div>
                      <div className='space-y-1.5'>
                        <Label htmlFor='smtpPort'>Puerto SMTP</Label>
                        <Select
                          value={String(settings.smtpPort)}
                          onValueChange={val => {
                            const port = parseInt(val)
                            setSettings({
                              ...settings,
                              smtpPort: port,
                              // 465 → SSL directo; 587/25 → STARTTLS
                              smtpSecure: port === 465,
                            })
                          }}
                        >
                          <SelectTrigger id='smtpPort'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='587'>587 — STARTTLS (recomendado)</SelectItem>
                            <SelectItem value='465'>465 — SSL/TLS directo</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className='text-xs text-muted-foreground'>
                          {settings.smtpPort === 465
                            ? 'SSL/TLS directo: la conexión cifra desde el inicio'
                            : 'STARTTLS: la conexión comienza sin cifrar y sube a TLS'}
                        </p>
                      </div>
                    </div>

                    {/* Usuario y contraseña */}
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      <div className='space-y-1.5'>
                        <Label htmlFor='smtpUser'>Usuario SMTP</Label>
                        <Input
                          id='smtpUser'
                          value={settings.smtpUser}
                          onChange={e => setSettings({ ...settings, smtpUser: e.target.value })}
                          placeholder='usuario@empresa.com'
                        />
                        <p className='text-xs text-muted-foreground'>
                          Tu dirección de correo completa (es el nombre de usuario SMTP)
                        </p>
                      </div>
                      <div className='space-y-1.5'>
                        <Label htmlFor='smtpPassword'>Contraseña SMTP</Label>
                        <Input
                          id='smtpPassword'
                          type='password'
                          value={settings.smtpPassword}
                          onChange={e => setSettings({ ...settings, smtpPassword: e.target.value })}
                          placeholder={
                            settings.smtpPasswordConfigured
                              ? 'Dejar vacío para mantener la actual'
                              : '••••••••'
                          }
                        />
                        {settings.smtpPasswordConfigured && !settings.smtpPassword ? (
                          <p className='text-xs text-muted-foreground'>
                            Hay una contraseña guardada. Escribe una nueva solo si deseas cambiarla.
                          </p>
                        ) : settings.smtpHost === 'smtp.gmail.com' ? (
                          <div className='rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 mt-1'>
                            <p className='text-xs font-medium text-amber-800 dark:text-amber-300'>
                              Gmail requiere una contraseña de aplicación
                            </p>
                            <p className='text-xs text-amber-700 dark:text-amber-400 mt-0.5'>
                              No uses tu contraseña de Google normal. Ve a{' '}
                              <a
                                href='https://myaccount.google.com/apppasswords'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='underline font-medium hover:text-amber-900 dark:hover:text-amber-200'
                              >
                                myaccount.google.com/apppasswords
                              </a>{' '}
                              y genera una contraseña de 16 caracteres para esta app.
                            </p>
                          </div>
                        ) : settings.smtpHost === 'smtp-mail.outlook.com' ||
                          settings.smtpHost === 'smtp.office365.com' ? (
                          <div className='rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 mt-1'>
                            <p className='text-xs font-medium text-blue-800 dark:text-blue-300'>
                              Microsoft puede requerir contraseña de aplicación
                            </p>
                            <p className='text-xs text-blue-700 dark:text-blue-400 mt-0.5'>
                              Si la autenticación básica está habilitada en tu tenant, usa una
                              contraseña de app desde{' '}
                              <a
                                href='https://account.microsoft.com/security'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='underline font-medium'
                              >
                                account.microsoft.com/security
                              </a>
                              . Algunas organizaciones desactivan SMTP básico — consulta con TI.
                            </p>
                          </div>
                        ) : (
                          <p className='text-xs text-muted-foreground'>
                            Tu contraseña de correo habitual
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Email remitente */}
                    <div className='space-y-1.5'>
                      <Label htmlFor='emailFrom'>Email Remitente</Label>
                      <div className='flex flex-wrap gap-2 items-start max-w-md'>
                        <Input
                          id='emailFrom'
                          type='email'
                          value={settings.emailFrom}
                          onChange={e => setSettings({ ...settings, emailFrom: e.target.value })}
                          placeholder='usuario@empresa.com'
                          className='flex-1 min-w-[200px]'
                        />
                        {settings.smtpUser?.trim() && (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='shrink-0'
                            onClick={() =>
                              setSettings({ ...settings, emailFrom: settings.smtpUser.trim() })
                            }
                          >
                            Usar usuario SMTP
                          </Button>
                        )}
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        Dirección que verán los destinatarios en el campo &quot;De:&quot;.
                        Normalmente igual al usuario SMTP.
                      </p>
                    </div>

                    {/* Resumen de la configuración activa */}
                    {settings.smtpHost && (
                      <div className='rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1'>
                        <p className='font-medium text-foreground text-sm mb-1'>
                          Resumen de configuración
                        </p>
                        <p>
                          <span className='font-medium text-foreground'>Servidor:</span>{' '}
                          {settings.smtpHost}:{settings.smtpPort}
                        </p>
                        <p>
                          <span className='font-medium text-foreground'>Cifrado:</span>{' '}
                          {settings.smtpPort === 465
                            ? 'SSL/TLS directo'
                            : settings.smtpPort === 587
                              ? 'STARTTLS'
                              : 'Sin cifrado'}
                        </p>
                        {settings.smtpUser && (
                          <p>
                            <span className='font-medium text-foreground'>Usuario:</span>{' '}
                            {settings.smtpUser}
                          </p>
                        )}
                      </div>
                    )}

                    <div className='pt-2'>
                      <Button variant='outline' onClick={testEmailConnection}>
                        <Mail className='h-4 w-4 mr-2' />
                        Probar Conexión
                      </Button>
                      <p className='text-xs text-muted-foreground mt-2'>
                        Envía un email de prueba a tu cuenta para verificar que la configuración es
                        correcta
                      </p>
                    </div>

                    {/* Panel de cola de emails */}
                    <div className='rounded-lg border border-border bg-muted/30 p-4 space-y-3 mt-2'>
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <Inbox className='h-4 w-4 text-muted-foreground' />
                          <span className='text-sm font-medium'>Cola de emails</span>
                        </div>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={loadEmailQueue}
                          disabled={emailQueueLoading}
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 mr-1.5 ${emailQueueLoading ? 'animate-spin' : ''}`}
                          />
                          Actualizar
                        </Button>
                      </div>

                      {emailQueueStats === null ? (
                        <p className='text-xs text-muted-foreground'>
                          Pulsa Actualizar para ver el estado de la cola.
                        </p>
                      ) : (
                        <div className='grid grid-cols-2 gap-3'>
                          <div className='rounded-md border border-border bg-background px-3 py-2 text-center'>
                            <p className='text-xl font-semibold'>{emailQueueStats.pending}</p>
                            <p className='text-xs text-muted-foreground'>Pendientes</p>
                          </div>
                          <div
                            className={`rounded-md border px-3 py-2 text-center ${emailQueueStats.failed > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-background'}`}
                          >
                            <p
                              className={`text-xl font-semibold ${emailQueueStats.failed > 0 ? 'text-destructive' : ''}`}
                            >
                              {emailQueueStats.failed}
                            </p>
                            <p className='text-xs text-muted-foreground'>Fallidos</p>
                          </div>
                        </div>
                      )}

                      <div className='flex gap-2 flex-wrap'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => processEmailQueue(false)}
                          disabled={emailQueueProcessing}
                        >
                          {emailQueueProcessing ? (
                            <RefreshCw className='h-3.5 w-3.5 mr-1.5 animate-spin' />
                          ) : (
                            <Send className='h-3.5 w-3.5 mr-1.5' />
                          )}
                          Procesar cola ahora
                        </Button>
                        {emailQueueStats && emailQueueStats.failed > 0 && (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => processEmailQueue(true)}
                            disabled={emailQueueProcessing}
                          >
                            <RefreshCw className='h-3.5 w-3.5 mr-1.5' />
                            Reintentar {emailQueueStats.failed} fallido
                            {emailQueueStats.failed !== 1 ? 's' : ''}
                          </Button>
                        )}
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        Los emails de notificaciones (tickets, etc.) se encolan y se envían en lote.
                        Si hay pendientes o fallidos, procésalos manualmente desde aquí.
                      </p>
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

                <div className='flex items-center justify-between p-4 border rounded-lg'>
                  <div className='space-y-0.5'>
                    <Label
                      htmlFor='telegramNotificationsEnabled'
                      className='text-base font-medium flex items-center gap-2'
                    >
                      <Send className='h-4 w-4 text-blue-500' />
                      Alertas por Telegram
                      {!isSuperAdmin && (
                        <Crown className='h-3 w-3 text-amber-500' aria-label='Solo Super Admin' />
                      )}
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Interruptor global de alertas salientes (tickets, inventario, rondas,
                      backups). Requiere bot habilitado en el tab Telegram.
                    </p>
                  </div>
                  <Switch
                    id='telegramNotificationsEnabled'
                    checked={settings.telegramNotificationsEnabled ?? true}
                    disabled={!isSuperAdmin}
                    onCheckedChange={checked =>
                      isSuperAdmin &&
                      setSettings({ ...settings, telegramNotificationsEnabled: checked })
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
                    <div className='space-y-3 pt-2'>
                      <div className='flex items-center space-x-2'>
                        <Switch
                          id='requirePasswordChange'
                          checked={settings.requirePasswordChange}
                          onCheckedChange={checked =>
                            setSettings({
                              ...settings,
                              requirePasswordChange: checked,
                              // Al desactivar, resetear el intervalo a 0
                              passwordChangeIntervalDays: checked
                                ? settings.passwordChangeIntervalDays || 90
                                : 0,
                            })
                          }
                        />
                        <Label htmlFor='requirePasswordChange'>Requerir cambio de contraseña</Label>
                      </div>
                      {settings.requirePasswordChange && (
                        <div className='ml-0 space-y-2 border-l-2 border-primary/20 pl-4'>
                          <Label htmlFor='passwordChangeIntervalDays' className='text-sm'>
                            Vigencia de la contraseña
                          </Label>
                          <Input
                            id='passwordChangeIntervalDays'
                            type='number'
                            value={settings.passwordChangeIntervalDays}
                            onChange={e => {
                              const value = parseInt(e.target.value)
                              setSettings({
                                ...settings,
                                passwordChangeIntervalDays: isNaN(value) ? 0 : Math.max(0, value),
                              })
                            }}
                            min='0'
                            max='365'
                            placeholder='0'
                          />
                          <p className='text-xs text-muted-foreground'>
                            {settings.passwordChangeIntervalDays === 0
                              ? '0 días — los usuarios deberán cambiar su contraseña en el próximo login (una sola vez)'
                              : `Los usuarios deberán cambiar su contraseña cada ${settings.passwordChangeIntervalDays} día${settings.passwordChangeIntervalDays !== 1 ? 's' : ''}`}
                          </p>
                          <p className='text-xs text-amber-600 dark:text-amber-400'>
                            Al activar y guardar por primera vez, los usuarios con contraseña local
                            deberán cambiarla en su próximo inicio de sesión. Cambiar solo los días
                            no vuelve a forzar el cambio.
                          </p>
                        </div>
                      )}
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

        {/* ─── Tab Telegram Bot ──────────────────────────────────────────── */}
        <TabsContent value='telegram'>
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
              {/* Card principal */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Send className='h-5 w-5 text-blue-500' />
                    Bot de Telegram
                  </CardTitle>
                  <CardDescription>
                    Configura el bot para enviar alertas operativas al staff (tickets, inventario,
                    backups) y permitir que los usuarios vinculen sus cuentas. El email sigue
                    funcionando en paralelo — Telegram es un canal adicional.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                  {/* Switch principal */}
                  <div className='flex items-center justify-between p-4 border rounded-lg'>
                    <div className='space-y-0.5'>
                      <Label htmlFor='telegramEnabled' className='text-base font-medium'>
                        Habilitar bot de Telegram
                      </Label>
                      <p className='text-sm text-muted-foreground'>
                        Activa el bot (token, webhook/polling y vinculación de cuentas). Las
                        alertas salientes se controlan aparte en Notificaciones.
                      </p>
                    </div>
                    <Switch
                      id='telegramEnabled'
                      checked={settings.telegramEnabled ?? false}
                      onCheckedChange={checked =>
                        setSettings({ ...settings, telegramEnabled: checked })
                      }
                    />
                  </div>

                  {settings.telegramEnabled && (
                    <>
                      {/* Token del bot */}
                      <div className='space-y-2'>
                        <Label htmlFor='telegramBotToken'>
                          Token del Bot{' '}
                          <span className='text-xs text-muted-foreground font-normal'>
                            (obtenido de @BotFather)
                          </span>
                        </Label>
                        <div className='relative'>
                          <Input
                            id='telegramBotToken'
                            type={showBotToken ? 'text' : 'password'}
                            value={settings.telegramBotToken}
                            onChange={e =>
                              setSettings({ ...settings, telegramBotToken: e.target.value })
                            }
                            placeholder={
                              settings.telegramBotTokenConfigured
                                ? 'Dejar vacío para mantener el actual'
                                : '123456789:AABBccDDeeffGGhh...'
                            }
                            className='pr-10'
                          />
                          <button
                            type='button'
                            onClick={() => setShowBotToken(v => !v)}
                            className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                          >
                            {showBotToken ? (
                              <EyeOff className='h-4 w-4' />
                            ) : (
                              <Eye className='h-4 w-4' />
                            )}
                          </button>
                        </div>
                        {settings.telegramBotTokenConfigured && !settings.telegramBotToken && (
                          <p className='text-xs text-muted-foreground'>
                            Hay un token guardado. Escribe uno nuevo solo si deseas cambiarlo.
                          </p>
                        )}
                      </div>

                      {/* Username del bot */}
                      <div className='space-y-2'>
                        <Label htmlFor='telegramBotUsername'>
                          Username del bot{' '}
                          <span className='text-xs text-muted-foreground font-normal'>
                            (sin @, ej: mi_sistema_bot)
                          </span>
                        </Label>
                        <Input
                          id='telegramBotUsername'
                          value={settings.telegramBotUsername}
                          onChange={e =>
                            setSettings({ ...settings, telegramBotUsername: e.target.value })
                          }
                          placeholder='mi_sistema_bot'
                        />
                        <p className='text-xs text-muted-foreground'>
                          Se usa para generar el enlace directo al bot en la UI de vinculación.
                        </p>
                      </div>

                      {/* Webhook secret */}
                      <div className='space-y-2'>
                        <Label htmlFor='telegramWebhookSecret'>
                          Webhook Secret{' '}
                          <span className='text-xs text-muted-foreground font-normal'>
                            (recomendado — genera con{' '}
                            <code className='font-mono'>openssl rand -hex 32</code>)
                          </span>
                        </Label>
                        <div className='relative'>
                          <Input
                            id='telegramWebhookSecret'
                            type={showWebhookSecret ? 'text' : 'password'}
                            value={settings.telegramWebhookSecret}
                            onChange={e =>
                              setSettings({ ...settings, telegramWebhookSecret: e.target.value })
                            }
                            placeholder={
                              settings.telegramWebhookSecretConfigured
                                ? 'Dejar vacío para mantener el actual'
                                : 'a1b2c3d4e5f6...'
                            }
                            className='pr-10'
                          />
                          <button
                            type='button'
                            onClick={() => setShowWebhookSecret(v => !v)}
                            className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                          >
                            {showWebhookSecret ? (
                              <EyeOff className='h-4 w-4' />
                            ) : (
                              <Eye className='h-4 w-4' />
                            )}
                          </button>
                        </div>
                        {settings.telegramWebhookSecretConfigured &&
                          !settings.telegramWebhookSecret && (
                            <p className='text-xs text-muted-foreground'>
                              Hay un secret guardado. Cámbialo solo si quieres rotar el secreto.
                            </p>
                          )}
                        {!settings.telegramWebhookSecretConfigured &&
                          !settings.telegramWebhookSecret && (
                            <p className='text-xs text-amber-700 dark:text-amber-400'>
                              Sin Webhook Secret, cualquiera podría enviar updates falsos al bot en
                              producción. Genera uno y guárdalo antes de registrar el webhook.
                            </p>
                          )}
                      </div>

                      {/* Aviso producción sin secret guardado */}
                      {(() => {
                        const origin = typeof window !== 'undefined' ? window.location.origin : ''
                        const isLocal =
                          origin.includes('localhost') ||
                          origin.includes('127.0.0.1') ||
                          /192\.168\.\d+\.\d+/.test(origin) ||
                          /10\.\d+\.\d+\.\d+/.test(origin) ||
                          /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/.test(origin)
                        if (
                          isLocal ||
                          settings.telegramWebhookSecretConfigured ||
                          settings.telegramWebhookSecret?.trim()
                        ) {
                          return null
                        }
                        return (
                          <div className='flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-4'>
                            <AlertTriangle className='h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0' />
                            <div className='space-y-1'>
                              <p className='text-sm font-medium text-amber-900 dark:text-amber-200'>
                                Webhook Secret pendiente
                              </p>
                              <p className='text-xs text-amber-800 dark:text-amber-300'>
                                En producción el endpoint{' '}
                                <code className='font-mono'>/api/telegram/webhook</code> rechazará
                                updates hasta que configures y guardes un secret.
                              </p>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Bot info tras verificar */}
                      {telegramBotInfo && (
                        <div className='flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800 p-4'>
                          <CheckCircle2 className='h-5 w-5 text-green-600 mt-0.5 flex-shrink-0' />
                          <div className='space-y-0.5'>
                            <p className='text-sm font-medium text-green-800 dark:text-green-300'>
                              Bot verificado: @{telegramBotInfo.username}
                            </p>
                            <p className='text-xs text-green-700 dark:text-green-400'>
                              {telegramBotInfo.firstName} · ID {telegramBotInfo.id}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Banner modo local / polling */}
                      {(() => {
                        const origin = typeof window !== 'undefined' ? window.location.origin : ''
                        const isLocal =
                          origin.includes('localhost') ||
                          origin.includes('127.0.0.1') ||
                          /192\.168\.\d+\.\d+/.test(origin) ||
                          /10\.\d+\.\d+\.\d+/.test(origin) ||
                          /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/.test(origin)
                        if (!isLocal) return null
                        return (
                          <div className='flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800 p-4'>
                            <AlertTriangle className='h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0' />
                            <div className='space-y-1.5'>
                              <p className='text-sm font-medium text-blue-900 dark:text-blue-200'>
                                Red local — usa Polling en lugar de Webhook
                              </p>
                              <p className='text-xs text-blue-800 dark:text-blue-300'>
                                Telegram no acepta IPs privadas para webhooks. Activa el cron de
                                polling ejecutando en tu terminal:
                              </p>
                              <code className='block text-xs font-mono bg-blue-100 dark:bg-blue-900/30 rounded px-2 py-1 text-blue-900 dark:text-blue-200'>
                                ./docker/scripts/setup-telegram-poll-cron.sh
                              </code>
                              <p className='text-xs text-blue-700 dark:text-blue-400'>
                                El botón &quot;Registrar Webhook&quot; funcionará cuando tengas un
                                dominio público con HTTPS.
                              </p>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Acciones */}
                      <div className='flex flex-wrap gap-3 pt-2'>
                        <Button
                          variant='outline'
                          onClick={testTelegramConnection}
                          disabled={telegramTesting}
                        >
                          {telegramTesting ? (
                            <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                          ) : (
                            <Send className='h-4 w-4 mr-2' />
                          )}
                          Probar conexión
                        </Button>
                        <Button
                          variant='outline'
                          onClick={registerTelegramWebhook}
                          disabled={registeringWebhook || !isSuperAdmin}
                          title={
                            !isSuperAdmin
                              ? 'Solo Super Admin puede registrar el webhook'
                              : typeof window !== 'undefined' &&
                            /192\.168\.|127\.0\.0\.1|localhost|^10\.|172\.(1[6-9]|2\d|3[01])\./.test(
                              window.location.origin
                            )
                              ? 'No disponible en red local — usa el cron de polling'
                              : undefined
                          }
                        >
                          {registeringWebhook ? (
                            <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                          ) : (
                            <ExternalLink className='h-4 w-4 mr-2' />
                          )}
                          Registrar Webhook
                        </Button>
                      </div>

                      {/* Cola de alertas salientes */}
                      <div className='rounded-lg border border-border bg-muted/30 p-4 space-y-3 mt-2'>
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-2'>
                            <Inbox className='h-4 w-4 text-muted-foreground' />
                            <span className='text-sm font-medium'>Cola de alertas Telegram</span>
                          </div>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={loadTelegramQueue}
                            disabled={telegramQueueLoading}
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 mr-1.5 ${telegramQueueLoading ? 'animate-spin' : ''}`}
                            />
                            Actualizar
                          </Button>
                        </div>

                        {telegramQueueStats === null ? (
                          <p className='text-xs text-muted-foreground'>
                            Pulsa Actualizar para ver pendientes y fallidos. El cron recomendado
                            procesa la cola cada 2 minutos.
                          </p>
                        ) : (
                          <div className='grid grid-cols-2 gap-3'>
                            <div className='rounded-md border border-border bg-background px-3 py-2 text-center'>
                              <p className='text-xl font-semibold'>{telegramQueueStats.pending}</p>
                              <p className='text-xs text-muted-foreground'>Pendientes</p>
                            </div>
                            <div
                              className={`rounded-md border px-3 py-2 text-center ${telegramQueueStats.failed > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-background'}`}
                            >
                              <p
                                className={`text-xl font-semibold ${telegramQueueStats.failed > 0 ? 'text-destructive' : ''}`}
                              >
                                {telegramQueueStats.failed}
                              </p>
                              <p className='text-xs text-muted-foreground'>Fallidos</p>
                            </div>
                          </div>
                        )}

                        {telegramQueueStats && telegramQueueStats.sending > 0 && (
                          <p className='text-xs text-muted-foreground'>
                            {telegramQueueStats.sending} en envío ahora mismo.
                          </p>
                        )}

                        <div className='flex gap-2 flex-wrap'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => processTelegramQueue(false)}
                            disabled={telegramQueueProcessing}
                          >
                            {telegramQueueProcessing ? (
                              <RefreshCw className='h-3.5 w-3.5 mr-1.5 animate-spin' />
                            ) : (
                              <Send className='h-3.5 w-3.5 mr-1.5' />
                            )}
                            Procesar cola ahora
                          </Button>
                          {telegramQueueStats && telegramQueueStats.failed > 0 && (
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => processTelegramQueue(true)}
                              disabled={telegramQueueProcessing}
                            >
                              <RefreshCw className='h-3.5 w-3.5 mr-1.5' />
                              Reintentar {telegramQueueStats.failed} fallido
                              {telegramQueueStats.failed !== 1 ? 's' : ''}
                            </Button>
                          )}
                        </div>
                        <p className='text-xs text-muted-foreground'>
                          Las alertas (tickets, rondas, inventario) se encolan y se envían con
                          reintentos automáticos. Instala el cron con{' '}
                          <code className='font-mono text-[10px]'>
                            setup-telegram-cleanup-cron.sh
                          </code>
                          .
                        </p>

                        {telegramQueueRecent &&
                          (telegramQueueRecent.failed.length > 0 ||
                            telegramQueueRecent.sent.length > 0) && (
                            <div className='space-y-3 pt-1 border-t border-border'>
                              {telegramQueueRecent.failed.length > 0 && (
                                <div className='space-y-1.5'>
                                  <p className='text-xs font-medium text-destructive'>
                                    Fallidos recientes
                                  </p>
                                  <ul className='space-y-1 max-h-32 overflow-y-auto'>
                                    {telegramQueueRecent.failed.map(row => (
                                      <li
                                        key={row.id}
                                        className='text-xs rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5'
                                      >
                                        <span className='font-medium'>{row.title}</span>
                                        {row.module && (
                                          <span className='text-muted-foreground'>
                                            {' '}
                                            · {row.module}
                                          </span>
                                        )}
                                        <span className='block text-muted-foreground truncate'>
                                          {row.errorMessage ?? 'Error desconocido'} (
                                          {row.attempts}/{row.maxAttempts})
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {telegramQueueRecent.sent.length > 0 && (
                                <div className='space-y-1.5'>
                                  <p className='text-xs font-medium text-muted-foreground'>
                                    Enviados recientemente
                                  </p>
                                  <ul className='space-y-1 max-h-32 overflow-y-auto'>
                                    {telegramQueueRecent.sent.map(row => (
                                      <li
                                        key={row.id}
                                        className='text-xs rounded-md border border-border bg-background px-2 py-1.5'
                                      >
                                        <span className='font-medium'>{row.title}</span>
                                        {row.module && (
                                          <span className='text-muted-foreground'>
                                            {' '}
                                            · {row.module}
                                          </span>
                                        )}
                                        {row.sentAt && (
                                          <span className='block text-muted-foreground'>
                                            {new Date(row.sentAt).toLocaleString()}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Card de instrucciones */}
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>Guía de configuración</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className='space-y-3 text-sm text-muted-foreground list-decimal list-inside'>
                    <li>
                      Abre Telegram y busca{' '}
                      <a
                        href='https://t.me/BotFather'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-primary hover:underline inline-flex items-center gap-1'
                      >
                        @BotFather <ExternalLink className='h-3 w-3' />
                      </a>
                      . Escribe <code className='font-mono text-xs'>/newbot</code> y sigue las
                      instrucciones.
                    </li>
                    <li>Copia el token que te da BotFather y pégalo en el campo de arriba.</li>
                    <li>
                      Pulsa <strong>Probar conexión</strong> para verificar el token.
                    </li>
                    <li>
                      Guarda la configuración con el botón <strong>Guardar</strong>.
                    </li>
                    <li>
                      <strong>Red local:</strong> ejecuta en tu terminal:{' '}
                      <code className='font-mono text-xs'>
                        ./docker/scripts/setup-telegram-poll-cron.sh
                      </code>{' '}
                      — activa el polling cada 30 s sin necesitar URL pública.
                      <br />
                      <strong>Producción (hosting):</strong> pulsa{' '}
                      <strong>Registrar Webhook</strong> para recibir mensajes en tiempo real.
                    </li>
                    <li>
                      Los usuarios pueden vincular sus cuentas desde{' '}
                      <strong>Configuración → Notificaciones → Telegram</strong> o desde su{' '}
                      <strong>Perfil</strong>.
                    </li>
                  </ol>
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
