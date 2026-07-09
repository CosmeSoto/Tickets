'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TimePicker } from '@/components/ui/time-picker'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PgBackRestStatusCard } from '@/components/backups/pgbackrest-status-card'
import {
  Settings,
  Clock,
  HardDrive,
  Shield,
  Cloud,
  AlertTriangle,
  CheckCircle,
  Save,
  RotateCcw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
] as const

interface BackupConfig {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  retentionDays: number
  maxBackups: number
  compression: boolean
  encryption: boolean
  cloudStorage: boolean
  cloudProvider?: 'google-drive' | 'onedrive'
  notifications: boolean
  emailNotifications: string[]
  verifyIntegrity: boolean
  scheduleTime: string
  weeklyFullDay: number
  /** Solo lectura — indica si BACKUP_ENCRYPTION_KEY está configurada en el servidor */
  encryptionKeyConfigured?: boolean
}

interface BackupConfigurationProps {
  onConfigChange?: (config: BackupConfig) => void
}

export function BackupConfiguration({ onConfigChange }: BackupConfigurationProps) {
  const [config, setConfig] = useState<BackupConfig>({
    enabled: true,
    frequency: 'daily',
    retentionDays: 30,
    maxBackups: 100,
    compression: true,
    encryption: false,
    cloudStorage: false,
    notifications: true,
    emailNotifications: [],
    verifyIntegrity: true,
    scheduleTime: '02:00',
    weeklyFullDay: 0,
  })

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [cloudAuthStatus, setCloudAuthStatus] = useState<{
    googleDrive: boolean
    oneDrive: boolean
  }>({ googleDrive: false, oneDrive: false })
  const [authorizingCloud, setAuthorizingCloud] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadConfiguration()
    loadCloudAuthStatus()
  }, [])

  const loadConfiguration = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/backups/config')
      if (response.ok) {
        const data = await response.json()
        setConfig(prev => ({ ...prev, ...data }))
      }
    } catch (error) {
      console.error('Error loading backup configuration:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCloudAuthStatus = async () => {
    try {
      const [googleRes, msRes] = await Promise.all([
        fetch('/api/admin/backups/cloud-auth?provider=google-drive'),
        fetch('/api/admin/backups/cloud-auth?provider=onedrive'),
      ])
      const [googleData, msData] = await Promise.all([
        googleRes.ok ? googleRes.json() : { authorized: false },
        msRes.ok ? msRes.json() : { authorized: false },
      ])
      setCloudAuthStatus({
        googleDrive: googleData.authorized ?? false,
        oneDrive: msData.authorized ?? false,
      })
    } catch {
      // silencioso — no crítico
    }
  }

  const authorizeCloud = async (provider: 'google-drive' | 'onedrive') => {
    setAuthorizingCloud(true)
    try {
      const res = await fetch(`/api/admin/backups/cloud-auth?provider=${provider}`)
      const data = await res.json()

      if (data.error) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
        return
      }

      if (data.authorized) {
        toast({
          title: 'Ya autorizado',
          description: `${provider === 'google-drive' ? 'Google Drive' : 'OneDrive'} ya está conectado.`,
        })
        return
      }

      if (data.oauthConfigured === false || !data.authUrl) {
        toast({
          title: 'OAuth no configurado',
          description:
            provider === 'google-drive'
              ? 'Configura y habilita Google en Configuración del sistema → OAuth antes de conectar Drive para backups.'
              : 'Configura y habilita Microsoft (Azure AD) en Configuración del sistema → OAuth antes de conectar OneDrive para backups.',
          variant: 'destructive',
        })
        return
      }

      // Abrir ventana de autorización OAuth
      window.open(data.authUrl, '_blank', 'width=600,height=700,scrollbars=yes')
      toast({
        title: 'Autorización iniciada',
        description:
          'Completa la autorización en la ventana que se abrió. Luego recarga esta página.',
      })
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setAuthorizingCloud(false)
    }
  }

  const revokeCloud = async (provider: 'google-drive' | 'onedrive') => {
    try {
      const res = await fetch(`/api/admin/backups/cloud-auth?provider=${provider}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setCloudAuthStatus(prev => ({
          ...prev,
          googleDrive: provider === 'google-drive' ? false : prev.googleDrive,
          oneDrive: provider === 'onedrive' ? false : prev.oneDrive,
        }))
        updateConfig('cloudStorage', false)
        updateConfig('cloudProvider', undefined)
        toast({
          title: 'Acceso revocado',
          description: `${provider === 'google-drive' ? 'Google Drive' : 'OneDrive'} desconectado.`,
        })
      }
    } catch {
      toast({ title: 'Error al revocar acceso', variant: 'destructive' })
    }
  }

  const saveConfiguration = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/backups/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (response.ok) {
        toast({
          title: 'Configuración guardada',
          description: 'Los cambios se han aplicado correctamente',
        })
        onConfigChange?.(config)
      } else {
        throw new Error('Error al guardar configuración')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    setConfig({
      enabled: true,
      frequency: 'daily',
      retentionDays: 30,
      maxBackups: 100,
      compression: true,
      encryption: false,
      cloudStorage: false,
      notifications: true,
      emailNotifications: [],
      verifyIntegrity: true,
      scheduleTime: '02:00',
      weeklyFullDay: 0,
    })
  }

  const addEmailNotification = () => {
    if (newEmail && !config.emailNotifications.includes(newEmail)) {
      setConfig(prev => ({
        ...prev,
        emailNotifications: [...prev.emailNotifications, newEmail],
      }))
      setNewEmail('')
    }
  }

  const removeEmailNotification = (email: string) => {
    setConfig(prev => ({
      ...prev,
      emailNotifications: prev.emailNotifications.filter(e => e !== email),
    }))
  }

  const updateConfig = (key: keyof BackupConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto'></div>
          <p className='mt-2 text-muted-foreground'>Cargando configuración...</p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <PgBackRestStatusCard onInitialized={onConfigChange} />

      {/* Header */}
      <div className='flex justify-between items-center'>
        <div>
          <h2 className='text-2xl font-bold text-foreground'>Configuración de Backups</h2>
          <p className='text-muted-foreground'>
            Personaliza el comportamiento del sistema de respaldos
          </p>
        </div>

        <div className='flex items-center space-x-3'>
          <Button variant='outline' onClick={resetToDefaults} size='sm'>
            <RotateCcw className='h-4 w-4 mr-2' />
            Restaurar
          </Button>

          <Button onClick={saveConfiguration} disabled={saving} size='sm'>
            <Save className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Configuración General */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <Settings className='h-5 w-5 text-primary' />
              <span>Configuración General</span>
            </CardTitle>
            <CardDescription>Configuración básica del sistema de backups</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <Label className='text-sm font-medium'>Backups Automáticos</Label>
                <p className='text-xs text-muted-foreground'>
                  Respaldos pgBackRest automáticos: FULL el día configurado abajo, DIFF el resto de
                  días
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={checked => updateConfig('enabled', checked)}
              />
            </div>

            <div className='space-y-2'>
              <Label className='text-sm font-medium'>Frecuencia</Label>
              <Select
                value={config.frequency}
                onValueChange={value => updateConfig('frequency', value)}
                disabled={!config.enabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Seleccionar frecuencia' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='daily'>Diario</SelectItem>
                  <SelectItem value='weekly'>Semanal</SelectItem>
                  <SelectItem value='monthly'>Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label className='text-sm font-medium'>Día del respaldo FULL</Label>
              <Select
                value={String(config.weeklyFullDay ?? 0)}
                onValueChange={value => updateConfig('weeklyFullDay', parseInt(value, 10))}
                disabled={!config.enabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Seleccionar día' />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map(day => (
                    <SelectItem key={day.value} value={String(day.value)}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Los demás días se ejecuta un respaldo DIFF. Por defecto: domingo = FULL.
              </p>
            </div>

            <div className='space-y-2'>
              <Label className='text-sm font-medium'>Hora de Ejecución</Label>
              <TimePicker
                value={config.scheduleTime}
                onChange={v => updateConfig('scheduleTime', v)}
                disabled={!config.enabled}
                className='w-full'
              />
              <p className='text-xs text-muted-foreground'>
                Ventana horaria del cron (±30 min). Motor: pgBackRest vía backup-worker
              </p>
            </div>

            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <Label className='text-sm font-medium'>Verificar Integridad</Label>
                <p className='text-xs text-muted-foreground'>
                  Verificar backups después de crearlos
                </p>
              </div>
              <Switch
                checked={config.verifyIntegrity}
                onCheckedChange={checked => updateConfig('verifyIntegrity', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Configuración de Retención */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <HardDrive className='h-5 w-5 text-primary' />
              <span>Retención y Almacenamiento</span>
            </CardTitle>
            <CardDescription>Configuración de almacenamiento y limpieza automática</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='space-y-2'>
              <Label className='text-sm font-medium'>Días de Retención</Label>
              <Input
                type='number'
                min='1'
                max='365'
                value={config.retentionDays}
                onChange={e => {
                  const value = parseInt(e.target.value)
                  updateConfig('retentionDays', isNaN(value) ? 30 : value)
                }}
              />
              <p className='text-xs text-muted-foreground'>
                Días que se mantendrán los backups automáticos
              </p>
            </div>

            <div className='space-y-2'>
              <Label className='text-sm font-medium'>Máximo de Backups</Label>
              <Input
                type='number'
                min='10'
                max='1000'
                value={config.maxBackups}
                onChange={e => {
                  const value = parseInt(e.target.value)
                  updateConfig('maxBackups', isNaN(value) ? 50 : value)
                }}
              />
              <p className='text-xs text-muted-foreground'>Número máximo de backups a mantener</p>
            </div>

            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <Label className='text-sm font-medium'>Compresión</Label>
                <p className='text-xs text-muted-foreground'>
                  Comprimir backups para ahorrar espacio
                </p>
              </div>
              <Switch
                checked={config.compression}
                onCheckedChange={checked => updateConfig('compression', checked)}
              />
            </div>

            {/* Encriptación — requiere BACKUP_ENCRYPTION_KEY en el servidor */}
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <div className='space-y-1'>
                  <div className='flex items-center gap-2'>
                    <Label className='text-sm font-medium'>Encriptación AES-256-GCM</Label>
                    {config.encryptionKeyConfigured ? (
                      <Badge variant='outline' className='text-xs flex items-center gap-1'>
                        <CheckCircle className='h-3 w-3 text-primary' />
                        Clave configurada
                      </Badge>
                    ) : (
                      <Badge
                        variant='outline'
                        className='text-xs flex items-center gap-1 text-muted-foreground'
                      >
                        <AlertTriangle className='h-3 w-3' />
                        Sin clave
                      </Badge>
                    )}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Cifra los archivos de backup con AES-256-GCM para protegerlos fuera del servidor
                  </p>
                </div>
                <Switch
                  checked={config.encryption}
                  onCheckedChange={checked => updateConfig('encryption', checked)}
                  disabled={!config.encryptionKeyConfigured}
                />
              </div>

              {/* Aviso si la clave no está configurada */}
              {!config.encryptionKeyConfigured && (
                <div className='p-3 bg-muted/50 border border-border rounded-lg'>
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    Para activar la encriptación, un administrador del servidor debe definir la
                    variable de entorno{' '}
                    <code className='font-mono bg-muted px-1 py-0.5 rounded text-foreground'>
                      BACKUP_ENCRYPTION_KEY
                    </code>{' '}
                    con un valor de al menos 32 caracteres.
                  </p>
                  <p className='text-xs text-muted-foreground mt-1'>
                    Genera una clave segura con:{' '}
                    <code className='font-mono bg-muted px-1 py-0.5 rounded text-foreground'>
                      openssl rand -hex 32
                    </code>
                  </p>
                </div>
              )}

              {/* Aviso si está activa — recordatorio de guardar la clave */}
              {config.encryptionKeyConfigured && config.encryption && (
                <div className='p-3 bg-muted/50 border border-border rounded-lg'>
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    <strong className='text-foreground'>Importante:</strong> Guarda{' '}
                    <code className='font-mono bg-muted px-1 py-0.5 rounded text-foreground'>
                      BACKUP_ENCRYPTION_KEY
                    </code>{' '}
                    en un lugar seguro. Sin ella, los backups cifrados no podrán restaurarse.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Almacenamiento en la Nube */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <Cloud className='h-5 w-5 text-primary' />
              <span>Almacenamiento en la Nube</span>
            </CardTitle>
            <CardDescription>
              Sube backups automáticamente a Google Drive o OneDrive usando las credenciales OAuth
              ya configuradas
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            {/* Google Drive */}
            <div className='rounded-lg border border-border p-4 space-y-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  {/* Google logo SVG */}
                  <svg className='h-5 w-5 flex-shrink-0' viewBox='0 0 24 24'>
                    <path
                      fill='#4285F4'
                      d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                    />
                    <path
                      fill='#34A853'
                      d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                    />
                    <path
                      fill='#FBBC05'
                      d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                    />
                    <path
                      fill='#EA4335'
                      d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                    />
                  </svg>
                  <div>
                    <p className='text-sm font-medium'>Google Drive</p>
                    <p className='text-xs text-muted-foreground'>
                      Carpeta: Sistema-Tickets-Backups
                    </p>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  {cloudAuthStatus.googleDrive ? (
                    <>
                      <Badge variant='outline' className='text-xs flex items-center gap-1'>
                        <CheckCircle className='h-3 w-3 text-primary' />
                        Conectado
                      </Badge>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-xs text-muted-foreground hover:text-destructive h-7'
                        onClick={() => revokeCloud('google-drive')}
                      >
                        Desconectar
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant='outline'
                      size='sm'
                      className='text-xs h-7'
                      onClick={() => authorizeCloud('google-drive')}
                      disabled={authorizingCloud}
                    >
                      Autorizar acceso
                    </Button>
                  )}
                </div>
              </div>

              {cloudAuthStatus.googleDrive && (
                <div className='flex items-center justify-between pt-1 border-t border-border'>
                  <Label className='text-xs text-muted-foreground'>Usar para backups</Label>
                  <Switch
                    checked={config.cloudStorage && config.cloudProvider === 'google-drive'}
                    onCheckedChange={checked => {
                      updateConfig('cloudStorage', checked)
                      updateConfig('cloudProvider', checked ? 'google-drive' : undefined)
                    }}
                  />
                </div>
              )}
            </div>

            {/* OneDrive */}
            <div className='rounded-lg border border-border p-4 space-y-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  {/* Microsoft logo SVG */}
                  <svg className='h-5 w-5 flex-shrink-0' viewBox='0 0 24 24'>
                    <path fill='#F25022' d='M1 1h10v10H1z' />
                    <path fill='#00A4EF' d='M13 1h10v10H13z' />
                    <path fill='#7FBA00' d='M1 13h10v10H1z' />
                    <path fill='#FFB900' d='M13 13h10v10H13z' />
                  </svg>
                  <div>
                    <p className='text-sm font-medium'>OneDrive</p>
                    <p className='text-xs text-muted-foreground'>
                      Carpeta: Sistema-Tickets-Backups
                    </p>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  {cloudAuthStatus.oneDrive ? (
                    <>
                      <Badge variant='outline' className='text-xs flex items-center gap-1'>
                        <CheckCircle className='h-3 w-3 text-primary' />
                        Conectado
                      </Badge>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-xs text-muted-foreground hover:text-destructive h-7'
                        onClick={() => revokeCloud('onedrive')}
                      >
                        Desconectar
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant='outline'
                      size='sm'
                      className='text-xs h-7'
                      onClick={() => authorizeCloud('onedrive')}
                      disabled={authorizingCloud}
                    >
                      Autorizar acceso
                    </Button>
                  )}
                </div>
              </div>

              {cloudAuthStatus.oneDrive && (
                <div className='flex items-center justify-between pt-1 border-t border-border'>
                  <Label className='text-xs text-muted-foreground'>Usar para backups</Label>
                  <Switch
                    checked={config.cloudStorage && config.cloudProvider === 'onedrive'}
                    onCheckedChange={checked => {
                      updateConfig('cloudStorage', checked)
                      updateConfig('cloudProvider', checked ? 'onedrive' : undefined)
                    }}
                  />
                </div>
              )}
            </div>

            {/* Aviso si ningún OAuth está configurado */}
            {!cloudAuthStatus.googleDrive && !cloudAuthStatus.oneDrive && (
              <div className='p-3 bg-muted/50 border border-border rounded-lg'>
                <p className='text-xs text-muted-foreground leading-relaxed'>
                  Para usar cloud storage, primero activa Google o Microsoft OAuth en{' '}
                  <strong className='text-foreground'>Configuración → OAuth</strong> y luego
                  autoriza el acceso aquí.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notificaciones */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <Shield className='h-5 w-5 text-primary' />
              <span>Notificaciones</span>
            </CardTitle>
            <CardDescription>Configuración de alertas y notificaciones</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <Label className='text-sm font-medium'>Notificaciones</Label>
                <p className='text-xs text-muted-foreground'>Recibir notificaciones de backups</p>
              </div>
              <Switch
                checked={config.notifications}
                onCheckedChange={checked => updateConfig('notifications', checked)}
              />
            </div>

            {config.notifications && (
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <Label className='text-sm font-medium'>Emails de Notificación</Label>
                  <div className='flex space-x-2'>
                    <Input
                      type='email'
                      placeholder='admin@empresa.com'
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addEmailNotification()}
                    />
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={addEmailNotification}
                      disabled={!newEmail}
                    >
                      Agregar
                    </Button>
                  </div>
                </div>

                {config.emailNotifications.length > 0 && (
                  <div className='space-y-2'>
                    <Label className='text-xs font-medium text-muted-foreground'>
                      Emails configurados:
                    </Label>
                    <div className='flex flex-wrap gap-2'>
                      {config.emailNotifications.map((email, index) => (
                        <Badge
                          key={index}
                          variant='secondary'
                          className='flex items-center space-x-1'
                        >
                          <span>{email}</span>
                          <button
                            onClick={() => removeEmailNotification(email)}
                            className='ml-1 text-muted-foreground hover:text-destructive'
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen de Configuración */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center space-x-2'>
            <CheckCircle className='h-5 w-5 text-primary' />
            <span>Resumen de Configuración</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='p-4 bg-muted/50 rounded-lg border border-border'>
              <div className='text-sm font-medium text-foreground mb-1'>Programación</div>
              <div className='text-xs text-muted-foreground'>
                {config.enabled ? (
                  <>
                    Backups{' '}
                    {config.frequency === 'daily'
                      ? 'diarios'
                      : config.frequency === 'weekly'
                        ? 'semanales'
                        : 'mensuales'}{' '}
                    a las {config.scheduleTime}
                  </>
                ) : (
                  'Backups automáticos deshabilitados'
                )}
              </div>
            </div>

            <div className='p-4 bg-muted/50 rounded-lg border border-border'>
              <div className='text-sm font-medium text-foreground mb-1'>Retención</div>
              <div className='text-xs text-muted-foreground'>
                {config.retentionDays} días • Máximo {config.maxBackups} backups
              </div>
            </div>

            <div className='p-4 bg-muted/50 rounded-lg border border-border'>
              <div className='text-sm font-medium text-foreground mb-1'>Características</div>
              <div className='text-xs text-muted-foreground'>
                {config.compression && 'Compresión • '}
                {config.encryption && 'Encriptación • '}
                {config.verifyIntegrity && 'Verificación • '}
                {config.cloudStorage && config.cloudProvider === 'google-drive' && 'Google Drive'}
                {config.cloudStorage && config.cloudProvider === 'onedrive' && 'OneDrive'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
