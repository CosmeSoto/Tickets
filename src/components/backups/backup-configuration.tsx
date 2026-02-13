'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Settings, 
  Clock, 
  HardDrive, 
  Shield, 
  Cloud,
  AlertTriangle,
  CheckCircle,
  Save,
  RotateCcw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface BackupConfig {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  retentionDays: number
  maxBackups: number
  compression: boolean
  encryption: boolean
  cloudStorage: boolean
  cloudProvider?: 'aws' | 'gcp' | 'azure'
  notifications: boolean
  emailNotifications: string[]
  verifyIntegrity: boolean
  scheduleTime: string
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
    scheduleTime: '02:00'
  })
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    loadConfiguration()
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

  const saveConfiguration = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/backups/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
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
      scheduleTime: '02:00'
    })
  }

  const addEmailNotification = () => {
    if (newEmail && !config.emailNotifications.includes(newEmail)) {
      setConfig(prev => ({
        ...prev,
        emailNotifications: [...prev.emailNotifications, newEmail]
      }))
      setNewEmail('')
    }
  }

  const removeEmailNotification = (email: string) => {
    setConfig(prev => ({
      ...prev,
      emailNotifications: prev.emailNotifications.filter(e => e !== email)
    }))
  }

  const updateConfig = (key: keyof BackupConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configuración de Backups</h2>
          <p className="text-muted-foreground">Personaliza el comportamiento del sistema de respaldos</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={resetToDefaults} size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar
          </Button>
          
          <Button onClick={saveConfiguration} disabled={saving} size="sm">
            <Save className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuración General */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <span>Configuración General</span>
            </CardTitle>
            <CardDescription>
              Configuración básica del sistema de backups
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Backups Automáticos</Label>
                <p className="text-xs text-muted-foreground">Habilitar creación automática de backups</p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => updateConfig('enabled', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Frecuencia</Label>
              <Select 
                value={config.frequency} 
                onValueChange={(value) => updateConfig('frequency', value)}
                disabled={!config.enabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar frecuencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Hora de Ejecución</Label>
              <Input
                type="time"
                value={config.scheduleTime}
                onChange={(e) => updateConfig('scheduleTime', e.target.value)}
                disabled={!config.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Hora en la que se ejecutarán los backups automáticos
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Verificar Integridad</Label>
                <p className="text-xs text-muted-foreground">Verificar backups después de crearlos</p>
              </div>
              <Switch
                checked={config.verifyIntegrity}
                onCheckedChange={(checked) => updateConfig('verifyIntegrity', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Configuración de Retención */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <HardDrive className="h-5 w-5 text-green-600" />
              <span>Retención y Almacenamiento</span>
            </CardTitle>
            <CardDescription>
              Configuración de almacenamiento y limpieza automática
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Días de Retención</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={config.retentionDays}
                onChange={(e) => updateConfig('retentionDays', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Días que se mantendrán los backups automáticos
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Máximo de Backups</Label>
              <Input
                type="number"
                min="10"
                max="1000"
                value={config.maxBackups}
                onChange={(e) => updateConfig('maxBackups', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Número máximo de backups a mantener
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Compresión</Label>
                <p className="text-xs text-muted-foreground">Comprimir backups para ahorrar espacio</p>
              </div>
              <Switch
                checked={config.compression}
                onCheckedChange={(checked) => updateConfig('compression', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Encriptación</Label>
                <p className="text-xs text-muted-foreground">Encriptar backups para mayor seguridad</p>
              </div>
              <Switch
                checked={config.encryption}
                onCheckedChange={(checked) => updateConfig('encryption', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Almacenamiento en la Nube */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Cloud className="h-5 w-5 text-purple-600" />
              <span>Almacenamiento en la Nube</span>
            </CardTitle>
            <CardDescription>
              Configuración de respaldo en servicios cloud
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Habilitar Cloud Storage</Label>
                <p className="text-xs text-muted-foreground">Respaldar automáticamente en la nube</p>
              </div>
              <Switch
                checked={config.cloudStorage}
                onCheckedChange={(checked) => updateConfig('cloudStorage', checked)}
              />
            </div>

            {config.cloudStorage && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Proveedor de Nube</Label>
                <Select 
                  value={config.cloudProvider || ''} 
                  onValueChange={(value) => updateConfig('cloudProvider', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">Amazon S3</SelectItem>
                    <SelectItem value="gcp">Google Cloud Storage</SelectItem>
                    <SelectItem value="azure">Azure Blob Storage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {config.cloudStorage && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Configuración Requerida</span>
                </div>
                <p className="text-xs text-yellow-700 mt-1">
                  Se requiere configurar las credenciales del proveedor en las variables de entorno
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notificaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-orange-600" />
              <span>Notificaciones</span>
            </CardTitle>
            <CardDescription>
              Configuración de alertas y notificaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Notificaciones</Label>
                <p className="text-xs text-muted-foreground">Recibir notificaciones de backups</p>
              </div>
              <Switch
                checked={config.notifications}
                onCheckedChange={(checked) => updateConfig('notifications', checked)}
              />
            </div>

            {config.notifications && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Emails de Notificación</Label>
                  <div className="flex space-x-2">
                    <Input
                      type="email"
                      placeholder="admin@empresa.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addEmailNotification()}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={addEmailNotification}
                      disabled={!newEmail}
                    >
                      Agregar
                    </Button>
                  </div>
                </div>

                {config.emailNotifications.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Emails configurados:</Label>
                    <div className="flex flex-wrap gap-2">
                      {config.emailNotifications.map((email, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="flex items-center space-x-1"
                        >
                          <span>{email}</span>
                          <button
                            onClick={() => removeEmailNotification(email)}
                            className="ml-1 text-muted-foreground hover:text-red-600"
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
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Resumen de Configuración</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-800 mb-1">Programación</div>
              <div className="text-xs text-blue-600">
                {config.enabled ? (
                  <>Backups {config.frequency === 'daily' ? 'diarios' : config.frequency === 'weekly' ? 'semanales' : 'mensuales'} a las {config.scheduleTime}</>
                ) : (
                  'Backups automáticos deshabilitados'
                )}
              </div>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm font-medium text-green-800 mb-1">Retención</div>
              <div className="text-xs text-green-600">
                {config.retentionDays} días • Máximo {config.maxBackups} backups
              </div>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm font-medium text-purple-800 mb-1">Características</div>
              <div className="text-xs text-purple-600">
                {config.compression && 'Compresión • '}
                {config.encryption && 'Encriptación • '}
                {config.verifyIntegrity && 'Verificación • '}
                {config.cloudStorage && 'Cloud Storage'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}