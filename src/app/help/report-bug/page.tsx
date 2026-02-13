'use client'

import { useState } from 'react'
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
  Bug,
  Send,
  AlertTriangle,
  Info,
  Upload,
  X
} from 'lucide-react'

export default function ReportBugPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    severity: 'MEDIUM',
    browser: '',
    os: '',
    steps: '',
    expected: '',
    actual: '',
    additional: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Simular envío de reporte de bug
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast({
        title: 'Reporte enviado',
        description: 'Tu reporte de bug ha sido enviado. Gracias por ayudarnos a mejorar.',
      })
      
      setFormData({
        title: '',
        severity: 'MEDIUM',
        browser: '',
        os: '',
        steps: '',
        expected: '',
        actual: '',
        additional: ''
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el reporte. Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <RoleDashboardLayout
      title='Reportar Problema'
      subtitle='Ayúdanos a mejorar reportando bugs y problemas técnicos'
    >
      <div className='max-w-4xl mx-auto space-y-6'>
        {/* Información */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                <Info className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-800">Información Importante</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Proporciona la mayor cantidad de detalles posible para ayudarnos a reproducir y solucionar el problema más rápidamente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bug className="h-5 w-5" />
                  <span>Reporte de Bug</span>
                </CardTitle>
                <CardDescription>
                  Completa todos los campos para ayudarnos a entender el problema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Título */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Título del problema *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Describe brevemente el problema"
                      required
                    />
                  </div>

                  {/* Severidad */}
                  <div className="space-y-2">
                    <Label>Severidad *</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'LOW', label: 'Baja', color: 'bg-green-100 text-green-800', desc: 'Problema menor' },
                        { value: 'MEDIUM', label: 'Media', color: 'bg-yellow-100 text-yellow-800', desc: 'Afecta funcionalidad' },
                        { value: 'HIGH', label: 'Alta', color: 'bg-orange-100 text-orange-800', desc: 'Bloquea trabajo' },
                        { value: 'CRITICAL', label: 'Crítica', color: 'bg-red-100 text-red-800', desc: 'Sistema no funciona' }
                      ].map((severity) => (
                        <Button
                          key={severity.value}
                          type="button"
                          variant={formData.severity === severity.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFormData({ ...formData, severity: severity.value })}
                          className="flex flex-col h-auto p-3"
                        >
                          <span className="font-medium">{severity.label}</span>
                          <span className="text-xs opacity-70">{severity.desc}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Información del Sistema */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="browser">Navegador</Label>
                      <Input
                        id="browser"
                        value={formData.browser}
                        onChange={(e) => setFormData({ ...formData, browser: e.target.value })}
                        placeholder="ej. Chrome 120, Firefox 121"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="os">Sistema Operativo</Label>
                      <Input
                        id="os"
                        value={formData.os}
                        onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                        placeholder="ej. Windows 11, macOS 14"
                      />
                    </div>
                  </div>

                  {/* Pasos para reproducir */}
                  <div className="space-y-2">
                    <Label htmlFor="steps">Pasos para reproducir el problema *</Label>
                    <Textarea
                      id="steps"
                      value={formData.steps}
                      onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                      placeholder="1. Ir a la página...&#10;2. Hacer clic en...&#10;3. Observar que..."
                      rows={4}
                      required
                    />
                  </div>

                  {/* Resultado esperado */}
                  <div className="space-y-2">
                    <Label htmlFor="expected">¿Qué esperabas que pasara? *</Label>
                    <Textarea
                      id="expected"
                      value={formData.expected}
                      onChange={(e) => setFormData({ ...formData, expected: e.target.value })}
                      placeholder="Describe el comportamiento esperado"
                      rows={3}
                      required
                    />
                  </div>

                  {/* Resultado actual */}
                  <div className="space-y-2">
                    <Label htmlFor="actual">¿Qué pasó en realidad? *</Label>
                    <Textarea
                      id="actual"
                      value={formData.actual}
                      onChange={(e) => setFormData({ ...formData, actual: e.target.value })}
                      placeholder="Describe lo que realmente sucedió"
                      rows={3}
                      required
                    />
                  </div>

                  {/* Información adicional */}
                  <div className="space-y-2">
                    <Label htmlFor="additional">Información adicional</Label>
                    <Textarea
                      id="additional"
                      value={formData.additional}
                      onChange={(e) => setFormData({ ...formData, additional: e.target.value })}
                      placeholder="Cualquier información adicional que pueda ser útil (mensajes de error, capturas de pantalla, etc.)"
                      rows={3}
                    />
                  </div>

                  {/* Adjuntos */}
                  <div className="space-y-2">
                    <Label>Archivos adjuntos</Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Arrastra archivos aquí o <Button variant="link" className="p-0 h-auto">selecciona archivos</Button>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Capturas de pantalla, logs, videos (máx. 10MB cada uno)
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={loading}>
                      <Send className="h-4 w-4 mr-2" />
                      {loading ? 'Enviando...' : 'Enviar Reporte'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Información Lateral */}
          <div className="space-y-6">
            {/* Consejos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Consejos</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <h4 className="font-medium mb-1">Sé específico</h4>
                  <p className="text-muted-foreground">Incluye detalles exactos sobre lo que estabas haciendo cuando ocurrió el problema.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Adjunta capturas</h4>
                  <p className="text-muted-foreground">Las imágenes ayudan mucho a entender el problema visualmente.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Incluye mensajes de error</h4>
                  <p className="text-muted-foreground">Copia y pega cualquier mensaje de error exactamente como aparece.</p>
                </div>
              </CardContent>
            </Card>

            {/* Estado del Sistema */}
            <Card>
              <CardHeader>
                <CardTitle>Estado del Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Servidor Principal</span>
                  <Badge className="bg-green-100 text-green-800">Operativo</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Base de Datos</span>
                  <Badge className="bg-green-100 text-green-800">Operativo</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Notificaciones</span>
                  <Badge className="bg-green-100 text-green-800">Operativo</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Archivos</span>
                  <Badge className="bg-yellow-100 text-yellow-800">Lento</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Problemas Conocidos */}
            <Card>
              <CardHeader>
                <CardTitle>Problemas Conocidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <h4 className="font-medium text-yellow-800">Carga lenta de archivos</h4>
                  <p className="text-yellow-700 text-xs mt-1">Estamos trabajando en optimizar la subida de archivos grandes.</p>
                </div>
                <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                  <h4 className="font-medium text-blue-800">Notificaciones en Safari</h4>
                  <p className="text-blue-700 text-xs mt-1">Las notificaciones push pueden no funcionar correctamente en Safari.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}