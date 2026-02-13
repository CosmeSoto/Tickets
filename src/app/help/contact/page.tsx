'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  MessageCircle,
  Mail,
  Phone,
  Clock,
  Send,
  CheckCircle,
  AlertCircle,
  Headphones
} from 'lucide-react'

interface HelpConfig {
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
  chatEnabled: boolean
  chatUrl: string | null
}

export default function ContactSupportPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)
  const [config, setConfig] = useState<HelpConfig | null>(null)
  const [formData, setFormData] = useState({
    subject: '',
    category: '',
    priority: 'MEDIUM',
    message: ''
  })

  // Cargar configuración del sistema de ayuda
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config/help')
        if (response.ok) {
          const data = await response.json()
          setConfig(data.data)
        }
      } catch (error) {
        console.error('Error loading help config:', error)
      } finally {
        setConfigLoading(false)
      }
    }

    loadConfig()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/help/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: 'Mensaje enviado',
          description: `${result.message} Número de ticket: ${result.data.ticketNumber}`,
        })
        
        setFormData({
          subject: '',
          category: '',
          priority: 'MEDIUM',
          message: ''
        })
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo enviar el mensaje. Intenta nuevamente.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje. Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getCurrentStatus = () => {
    if (!config) return { status: 'unknown', message: 'Cargando...' }

    const now = new Date()
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()] as keyof typeof config.supportHours
    const todayHours = config.supportHours[dayName]

    if (todayHours === 'closed') {
      return { status: 'closed', message: 'Cerrado hoy' }
    }

    const [start, end] = todayHours.split('-')
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    
    const currentTime = now.getHours() * 60 + now.getMinutes()
    const startTime = startHour * 60 + startMin
    const endTime = endHour * 60 + endMin

    if (currentTime >= startTime && currentTime <= endTime) {
      return { status: 'open', message: 'Disponible ahora' }
    } else {
      return { status: 'closed', message: 'Fuera de horario' }
    }
  }

  const currentStatus = getCurrentStatus()

  if (configLoading) {
    return (
      <RoleDashboardLayout
        title='Contactar Soporte'
        subtitle='Obtén ayuda directa de nuestro equipo de soporte'
      >
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title='Contactar Soporte'
      subtitle={`Obtén ayuda directa de nuestro equipo de ${config?.companyName || 'soporte'}`}
    >
      <div className='max-w-4xl mx-auto space-y-6'>
        {/* Estado del Soporte */}
        <Card className={currentStatus.status === 'open' ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                currentStatus.status === 'open' ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                {currentStatus.status === 'open' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 text-yellow-600" />
                )}
              </div>
              <div>
                <h3 className={`font-semibold ${
                  currentStatus.status === 'open' ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  {currentStatus.status === 'open' ? 'Soporte Disponible' : 'Soporte Fuera de Horario'}
                </h3>
                <p className={`text-sm ${
                  currentStatus.status === 'open' ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  {currentStatus.message}
                </p>
              </div>
              <div className="ml-auto">
                <Badge className={
                  currentStatus.status === 'open' 
                    ? "bg-green-100 text-green-800" 
                    : "bg-yellow-100 text-yellow-800"
                }>
                  {currentStatus.status === 'open' && (
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  )}
                  {currentStatus.message}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario de Contacto */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Enviar Mensaje</span>
                </CardTitle>
                <CardDescription>
                  Describe tu problema o pregunta y te ayudaremos lo antes posible
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Asunto</Label>
                      <Input
                        id="subject"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Describe brevemente tu problema"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Categoría</Label>
                      <select
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        required
                      >
                        <option value="">Selecciona una categoría</option>
                        <option value="technical">Problema Técnico</option>
                        <option value="account">Cuenta y Acceso</option>
                        <option value="billing">Facturación</option>
                        <option value="feature">Solicitud de Función</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioridad</Label>
                    <div className="flex space-x-2">
                      {[
                        { value: 'LOW', label: 'Baja', color: 'bg-green-100 text-green-800' },
                        { value: 'MEDIUM', label: 'Media', color: 'bg-yellow-100 text-yellow-800' },
                        { value: 'HIGH', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
                        { value: 'URGENT', label: 'Urgente', color: 'bg-red-100 text-red-800' }
                      ].map((priority) => (
                        <Button
                          key={priority.value}
                          type="button"
                          variant={formData.priority === priority.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFormData({ ...formData, priority: priority.value })}
                        >
                          {priority.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Mensaje</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Describe tu problema en detalle. Incluye pasos para reproducir el problema si es técnico."
                      rows={6}
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={loading}>
                      <Send className="h-4 w-4 mr-2" />
                      {loading ? 'Enviando...' : 'Enviar Mensaje'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Información de Contacto */}
          <div className="space-y-6">
            {/* Horarios */}
            {config && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>Horarios de Atención</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(config.supportHours).map(([day, hours]) => (
                    <div key={day} className="flex justify-between">
                      <span className="text-sm text-muted-foreground capitalize">
                        {day === 'monday' ? 'Lunes' :
                         day === 'tuesday' ? 'Martes' :
                         day === 'wednesday' ? 'Miércoles' :
                         day === 'thursday' ? 'Jueves' :
                         day === 'friday' ? 'Viernes' :
                         day === 'saturday' ? 'Sábado' : 'Domingo'}
                      </span>
                      <span className={`text-sm font-medium ${
                        hours === 'closed' ? 'text-red-600' : ''
                      }`}>
                        {hours === 'closed' ? 'Cerrado' : hours}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        currentStatus.status === 'open' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                      }`} />
                      <span className={`text-sm font-medium ${
                        currentStatus.status === 'open' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {currentStatus.message}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contacto Directo */}
            {config && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Headphones className="h-5 w-5" />
                    <span>Contacto Directo</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Email</div>
                      <div className="text-sm text-muted-foreground">{config.supportEmail}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                      <Phone className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Teléfono</div>
                      <div className="text-sm text-muted-foreground">{config.supportPhone}</div>
                    </div>
                  </div>
                  {config.chatEnabled && config.chatUrl && (
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full">
                        <MessageCircle className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Chat en Vivo</div>
                        <div className="text-sm text-muted-foreground">
                          {currentStatus.status === 'open' ? 'Disponible ahora' : 'Disponible en horario laboral'}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tiempos de Respuesta */}
            {config && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5" />
                    <span>Tiempos de Respuesta</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(config.responseTimes).map(([priority, time]) => (
                    <div key={priority} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground capitalize">
                        {priority === 'urgent' ? 'Urgente' :
                         priority === 'high' ? 'Alta' :
                         priority === 'medium' ? 'Media' : 'Baja'}
                      </span>
                      <Badge className={
                        priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }>
                        {time}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}