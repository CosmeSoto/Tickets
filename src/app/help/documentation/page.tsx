'use client'

import { useState, useEffect } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  BookOpen,
  ExternalLink,
  FileText,
  Video,
  Download,
  Star,
  Clock,
  Users,
  ArrowRight
} from 'lucide-react'

interface HelpConfig {
  documentationUrl: string
  videoTutorialsUrl: string
  companyName: string
}

const documentationSections = [
  {
    id: 'getting-started',
    title: 'Primeros Pasos',
    description: 'Guías básicas para comenzar a usar el sistema',
    icon: BookOpen,
    color: 'bg-blue-50 text-blue-600',
    articles: [
      {
        title: 'Introducción al Sistema de Tickets',
        description: 'Aprende los conceptos básicos y la navegación',
        type: 'guide',
        readTime: '5 min',
        difficulty: 'Básico'
      },
      {
        title: 'Configuración Inicial de Usuario',
        description: 'Configura tu perfil y preferencias',
        type: 'tutorial',
        readTime: '10 min',
        difficulty: 'Básico'
      },
      {
        title: 'Creando tu Primer Ticket',
        description: 'Paso a paso para crear un ticket efectivo',
        type: 'tutorial',
        readTime: '8 min',
        difficulty: 'Básico'
      }
    ]
  },
  {
    id: 'user-guide',
    title: 'Guía de Usuario',
    description: 'Documentación completa para usuarios finales',
    icon: Users,
    color: 'bg-green-50 text-green-600',
    articles: [
      {
        title: 'Gestión de Tickets',
        description: 'Cómo crear, editar y dar seguimiento a tickets',
        type: 'guide',
        readTime: '15 min',
        difficulty: 'Intermedio'
      },
      {
        title: 'Sistema de Prioridades',
        description: 'Entiende cómo funcionan las prioridades',
        type: 'reference',
        readTime: '7 min',
        difficulty: 'Básico'
      },
      {
        title: 'Comunicación y Comentarios',
        description: 'Mejores prácticas para comunicarte con el equipo',
        type: 'guide',
        readTime: '12 min',
        difficulty: 'Básico'
      }
    ]
  },
  {
    id: 'admin-guide',
    title: 'Guía de Administrador',
    description: 'Documentación para administradores del sistema',
    icon: FileText,
    color: 'bg-purple-50 text-purple-600',
    articles: [
      {
        title: 'Configuración del Sistema',
        description: 'Configuraciones avanzadas y personalización',
        type: 'guide',
        readTime: '25 min',
        difficulty: 'Avanzado'
      },
      {
        title: 'Gestión de Usuarios y Roles',
        description: 'Administrar usuarios, roles y permisos',
        type: 'tutorial',
        readTime: '20 min',
        difficulty: 'Intermedio'
      },
      {
        title: 'Reportes y Analytics',
        description: 'Generar reportes y analizar métricas',
        type: 'guide',
        readTime: '18 min',
        difficulty: 'Intermedio'
      }
    ]
  },
  {
    id: 'api-docs',
    title: 'Documentación API',
    description: 'Referencia técnica para desarrolladores',
    icon: FileText,
    color: 'bg-orange-50 text-orange-600',
    articles: [
      {
        title: 'API Reference',
        description: 'Documentación completa de endpoints',
        type: 'reference',
        readTime: '30 min',
        difficulty: 'Avanzado'
      },
      {
        title: 'Autenticación y Autorización',
        description: 'Cómo autenticarse con la API',
        type: 'tutorial',
        readTime: '15 min',
        difficulty: 'Avanzado'
      },
      {
        title: 'Webhooks y Integraciones',
        description: 'Integra el sistema con otras herramientas',
        type: 'guide',
        readTime: '22 min',
        difficulty: 'Avanzado'
      }
    ]
  }
]

const quickLinks = [
  {
    title: 'Guía de Inicio Rápido',
    description: 'Comienza en 5 minutos',
    icon: ArrowRight,
    color: 'text-blue-600'
  },
  {
    title: 'Preguntas Frecuentes',
    description: 'Respuestas a dudas comunes',
    icon: BookOpen,
    color: 'text-green-600'
  },
  {
    title: 'Video Tutoriales',
    description: 'Aprende viendo',
    icon: Video,
    color: 'text-purple-600'
  },
  {
    title: 'Descargas',
    description: 'Recursos y plantillas',
    icon: Download,
    color: 'text-orange-600'
  }
]

export default function DocumentationPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [config, setConfig] = useState<HelpConfig | null>(null)

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
      }
    }

    loadConfig()
  }, [])

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Básico':
        return 'bg-green-100 text-green-800'
      case 'Intermedio':
        return 'bg-yellow-100 text-yellow-800'
      case 'Avanzado':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-muted text-foreground'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'tutorial':
        return Video
      case 'reference':
        return FileText
      default:
        return BookOpen
    }
  }

  return (
    <RoleDashboardLayout
      title='Documentación'
      subtitle={`Guías completas y recursos para ${config?.companyName || 'el sistema'}`}
    >
      <div className='max-w-6xl mx-auto space-y-8'>
        {/* Búsqueda */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-3 bg-blue-100 rounded-full">
                  <BookOpen className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Documentación</h2>
                <p className="text-muted-foreground mt-2">Encuentra guías detalladas y referencias técnicas</p>
              </div>
              <div className="max-w-2xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                  <Input
                    placeholder="Buscar en la documentación..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 h-12 text-lg"
                  />
                  <Button className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    Buscar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enlaces Rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link, index) => {
            const Icon = link.icon
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="flex justify-center">
                      <Icon className={`h-6 w-6 ${link.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{link.title}</h3>
                      <p className="text-xs text-muted-foreground">{link.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Enlaces Externos */}
        {config && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="p-3 bg-blue-100 rounded-full">
                      <BookOpen className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900">Documentación Oficial</h3>
                    <p className="text-sm text-blue-700 mt-2">
                      Accede a la documentación completa y actualizada
                    </p>
                  </div>
                  <Button asChild>
                    <a href={config.documentationUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Documentación
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="p-3 bg-purple-100 rounded-full">
                      <Video className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-purple-900">Video Tutoriales</h3>
                    <p className="text-sm text-purple-700 mt-2">
                      Aprende con tutoriales paso a paso en video
                    </p>
                  </div>
                  <Button variant="outline" asChild>
                    <a href={config.videoTutorialsUrl} target="_blank" rel="noopener noreferrer">
                      <Video className="h-4 w-4 mr-2" />
                      Ver Videos
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Secciones de Documentación */}
        <div className="space-y-8">
          {documentationSections.map((section) => {
            const Icon = section.icon
            return (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${section.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span>{section.title}</span>
                  </CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {section.articles.map((article, index) => {
                      const TypeIcon = getTypeIcon(article.type)
                      return (
                        <div key={index} className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <TypeIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                              <Badge className={getDifficultyColor(article.difficulty)}>
                                {article.difficulty}
                              </Badge>
                            </div>
                            <div>
                              <h4 className="font-medium text-foreground mb-2">{article.title}</h4>
                              <p className="text-sm text-muted-foreground mb-3">{article.description}</p>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 mr-1" />
                                {article.readTime}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Footer */}
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold text-foreground">¿No encuentras lo que buscas?</h3>
              <p className="text-muted-foreground">
                Contáctanos para obtener ayuda personalizada o solicitar nueva documentación
              </p>
              <div className="flex justify-center space-x-4">
                <Button asChild>
                  <a href="/help/contact">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Contactar Soporte
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/help/center">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Centro de Ayuda
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}