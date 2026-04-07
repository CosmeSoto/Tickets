'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Settings,
  Save,
  RefreshCw,
  Mail,
  Phone,
  Clock,
  Building,
  MessageCircle,
  BookOpen,
  Bug,
  AlertCircle
} from 'lucide-react'

interface HelpSystemConfig {
  supportEmail: string
  supportPhone: string
  supportHours: {
    monday: string
    tuesday: string
    wednesday: string
    thursday: string
    friday: string
    saturday: string
    sunday: string
  }
  responseTimes: {
    urgent: string
    high: string
    medium: string
    low: string
  }
  companyName: string
  companyAddress: string
  chatEnabled: boolean
  chatUrl: string
  documentationUrl: string
  videoTutorialsUrl: string
  statusPageUrl: string
  bugReportEnabled: boolean
  feedbackEnabled: boolean
}

export default function HelpConfigPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)
  const [config, setConfig] = useState<HelpSystemConfig | null>(null)

  // Cargar configuración actual
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/admin/config/help')
        if (response.ok) {
          const data = await response.json()
          setConfig(data.data)
        } else {
          toast({
            title: 'Error',
            description: 'No se pudo cargar la configuración',
            variant: 'destructive',
          })
        }
      } catch (error) {
        console.error('Error loading config:', error)
        toast({
          title: 'Error',
          description: 'Error al cargar la configuración',
          variant: 'destructive',
        })
      } finally {
        setConfigLoading(false)
      }
    }

    if (session?.user?.role === 'ADMIN') {
      loadConfig()
    }
  }, [session, toast])

  const handleSave = async () => {
    if (!config) return

    setLoading(true)
    try {
      const response = await fetch('/api/admin/config/help', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: 'Configuración guardada',
          description: 'Los cambios se han aplicado exitosamente',
        })
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo guardar la configuración',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al guardar la configuración',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = (updates: Partial<HelpSystemConfig>) => {
    if (!config) return
    setConfig({ ...config, ...updates })
  }

  const updateSupportHours = (day: keyof HelpSystemConfig['supportHours'], value: string) => {
    if (!config) return
    setConfig({
      ...config,
      supportHours: {
        ...config.supportHours,
        [day]: value
      }
    })
  }

  const updateResponseTimes = (priority: keyof HelpSystemConfig['responseTimes'], value: string) => {
    if (!config) return
    setConfig({
      ...config,
      responseTimes: {
        ...config.responseTimes,
        [priority]: value
      }
    })
  }

  if (session?.user?.role !== 'ADMIN') {
    return (
      <RoleDashboardLayout title='Acceso Denegado'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <AlertCircle className='h-12 w-12 text-red-500 mx-auto mb-4' />
            <h2 className='text-xl font-semibold text-foreground mb-2'>Acceso Denegado</h2>
            <p className='text-muted-foreground'>Solo los administradores pueden acceder a esta página.</p>
          </div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (configLoading) {
    return (
      <RoleDashboardLayout title='Configuración del Sistema de Ayuda'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!config) {
    return (
      <RoleDashboardLayout title='Configuración del Sistema de Ayuda'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <AlertCircle className='h-12 w-12 text-red-500 mx-auto mb-4' />
            <h2 className='text-xl font-semibold text-foreground mb-2'>Error</h2>
            <p className='text-muted-foreground'>No se pudo cargar la configuración del sistema de ayuda.</p>
          </div>
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title='Configuración del Sistema de Ayuda'
      subtitle='Gestiona la configuración del centro de ayuda y soporte'
      headerActions={
        <Button onClick={handleSave} disabled={loading}>
          <Save className='h-4 w-4 mr-2' />
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      }
    >
      <div className='max-w-4xl mx-auto'>
        <Tabs defaultValue='contact' className='space-y-6'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='contact'>Contacto</TabsTrigger>
            <TabsTrigger value='hours'>Horarios</TabsTrigger>
            <TabsTrigger value='features'>Funciones</TabsTrigger>
            <TabsTrigger value='urls'>Enlaces</TabsTrigger>
          </TabsList>

          {/* Información de Contacto */}
          <TabsContent value='contact' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center space-x-2'>
                  <Building className='h-5 w-5' />
                  <span>Información de la Empresa</span>
                </CardTitle>
                <CardDescription>
                  Configura la información básica de tu empresa
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='companyName'>Nombre de la Empresa</Label>
                    <Input
                      id='companyName'
                      value={config.companyName}
                      onChange={(e) => updateConfig({ companyName: e.target.value })}
                      placeholder='TicketPro'
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='supportEmail'>Email de Soporte</Label>
                    <Input
                      id='supportEmail'
                      type='email'
                      value={config.supportEmail}
                      onChange={(e) => updateConfig({ supportEmail: e.target.value })}
                      placeholder='internet.freecom@gmail.com'
                    />
                  </div>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='supportPhone'>Teléfono de Soporte</Label>
                    <Input
                      id='supportPhone'
                      value={config.supportPhone}
                      onChange={(e) => updateConfig({ supportPhone: e.target.value })}
                      placeholder='+1 (555) 123-4567'
                    />
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='companyAddress'>Dirección de la Empresa</Label>
                  <Textarea
                    id='companyAddress'
                    value={config.companyAddress}
                    onChange={(e) => updateConfig({ companyAddress: e.target.value })}
                    placeholder='123 Tech Street, Silicon Valley, CA 94000'
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Horarios y Tiempos de Respuesta */}
          <TabsContent value='hours' className='space-y-6'>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center space-x-2'>
                    <Clock className='h-5 w-5' />
                    <span>Horarios de Atención</span>
                  </CardTitle>
                  <CardDescription>
                    Define los horarios de atención al cliente
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {Object.entries(config.supportHours).map(([day, hours]) => (
                    <div key={day} className='flex items-center justify-between'>
                      <Label className='capitalize min-w-[100px]'>
                        {day === 'monday' ? 'Lunes' :
                         day === 'tuesday' ? 'Martes' :
                         day === 'wednesday' ? 'Miércoles' :
                         day === 'thursday' ? 'Jueves' :
                         day === 'friday' ? 'Viernes' :
                         day === 'saturday' ? 'Sábado' : 'Domingo'}
                      </Label>
                      <Input
                        value={hours}
                        onChange={(e) => updateSupportHours(day as keyof HelpSystemConfig['supportHours'], e.target.value)}
                        placeholder='9:00-18:00 o closed'
                        className='max-w-[150px]'
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center space-x-2'>
                    <RefreshCw className='h-5 w-5' />
                    <span>Tiempos de Respuesta</span>
                  </CardTitle>
                  <CardDescription>
                    Define los tiempos de respuesta por prioridad
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {Object.entries(config.responseTimes).map(([priority, time]) => (
                    <div key={priority} className='flex items-center justify-between'>
                      <Label className='capitalize min-w-[100px]'>
                        {priority === 'urgent' ? 'Urgente' :
                         priority === 'high' ? 'Alta' :
                         priority === 'medium' ? 'Media' : 'Baja'}
                      </Label>
                      <Input
                        value={time}
                        onChange={(e) => updateResponseTimes(priority as keyof HelpSystemConfig['responseTimes'], e.target.value)}
                        placeholder='1-2 horas'
                        className='max-w-[150px]'
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Funciones del Sistema */}
          <TabsContent value='features' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center space-x-2'>
                  <Settings className='h-5 w-5' />
                  <span>Funciones Disponibles</span>
                </CardTitle>
                <CardDescription>
                  Habilita o deshabilita funciones del sistema de ayuda
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-6'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <div className='flex items-center space-x-2'>
                      <MessageCircle className='h-4 w-4' />
                      <Label>Chat en Vivo</Label>
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      Permite a los usuarios acceder al chat en vivo
                    </p>
                  </div>
                  <Switch
                    checked={config.chatEnabled}
                    onCheckedChange={(checked) => updateConfig({ chatEnabled: checked })}
                  />
                </div>

                {config.chatEnabled && (
                  <div className='space-y-2 ml-6'>
                    <Label htmlFor='chatUrl'>URL del Chat</Label>
                    <Input
                      id='chatUrl'
                      value={config.chatUrl}
                      onChange={(e) => updateConfig({ chatUrl: e.target.value })}
                      placeholder='https://chat.empresa.com'
                    />
                  </div>
                )}

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <div className='flex items-center space-x-2'>
                      <Bug className='h-4 w-4' />
                      <Label>Reporte de Bugs</Label>
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      Permite a los usuarios reportar problemas técnicos
                    </p>
                  </div>
                  <Switch
                    checked={config.bugReportEnabled}
                    onCheckedChange={(checked) => updateConfig({ bugReportEnabled: checked })}
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <div className='flex items-center space-x-2'>
                      <MessageCircle className='h-4 w-4' />
                      <Label>Sistema de Feedback</Label>
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      Permite a los usuarios enviar comentarios y sugerencias
                    </p>
                  </div>
                  <Switch
                    checked={config.feedbackEnabled}
                    onCheckedChange={(checked) => updateConfig({ feedbackEnabled: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* URLs y Enlaces */}
          <TabsContent value='urls' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center space-x-2'>
                  <BookOpen className='h-5 w-5' />
                  <span>Enlaces Externos</span>
                </CardTitle>
                <CardDescription>
                  Configura los enlaces a recursos externos
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='documentationUrl'>URL de Documentación</Label>
                  <Input
                    id='documentationUrl'
                    value={config.documentationUrl}
                    onChange={(e) => updateConfig({ documentationUrl: e.target.value })}
                    placeholder='https://docs.empresa.com'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='videoTutorialsUrl'>URL de Video Tutoriales</Label>
                  <Input
                    id='videoTutorialsUrl'
                    value={config.videoTutorialsUrl}
                    onChange={(e) => updateConfig({ videoTutorialsUrl: e.target.value })}
                    placeholder='https://videos.empresa.com'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='statusPageUrl'>URL de Página de Estado</Label>
                  <Input
                    id='statusPageUrl'
                    value={config.statusPageUrl}
                    onChange={(e) => updateConfig({ statusPageUrl: e.target.value })}
                    placeholder='https://status.empresa.com'
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RoleDashboardLayout>
  )
}