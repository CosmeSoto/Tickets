'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  BookOpen,
  MessageCircle,
  Video,
  FileText,
  Users,
  Settings,
  Ticket,
  HelpCircle,
  ExternalLink,
  Star,
  Clock
} from 'lucide-react'
import Link from 'next/link'

interface HelpConfig {
  supportEmail: string
  supportPhone: string
  companyName: string
  chatEnabled: boolean
  chatUrl: string | null
  documentationUrl: string
  videoTutorialsUrl: string
  statusPageUrl: string
  bugReportEnabled: boolean
  feedbackEnabled: boolean
}

const helpCategories = [
  {
    id: 'getting-started',
    title: 'Primeros Pasos',
    description: 'Aprende lo básico para comenzar',
    icon: BookOpen,
    color: 'bg-blue-50 text-blue-600',
    articles: [
      { title: 'Cómo crear tu primer ticket', views: 1250, rating: 4.8 },
      { title: 'Navegando por el dashboard', views: 980, rating: 4.6 },
      { title: 'Configuración inicial de perfil', views: 750, rating: 4.7 }
    ]
  },
  {
    id: 'tickets',
    title: 'Gestión de Tickets',
    description: 'Todo sobre crear y gestionar tickets',
    icon: Ticket,
    color: 'bg-green-50 text-green-600',
    articles: [
      { title: 'Estados de tickets explicados', views: 2100, rating: 4.9 },
      { title: 'Prioridades y escalación', views: 1800, rating: 4.5 },
      { title: 'Adjuntar archivos y capturas', views: 1200, rating: 4.4 }
    ]
  },
  {
    id: 'account',
    title: 'Mi Cuenta',
    description: 'Configuración y personalización',
    icon: Settings,
    color: 'bg-purple-50 text-purple-600',
    articles: [
      { title: 'Cambiar contraseña y seguridad', views: 950, rating: 4.7 },
      { title: 'Configurar notificaciones', views: 800, rating: 4.3 },
      { title: 'Personalizar preferencias', views: 650, rating: 4.5 }
    ]
  },
  {
    id: 'collaboration',
    title: 'Colaboración',
    description: 'Trabajar en equipo efectivamente',
    icon: Users,
    color: 'bg-orange-50 text-orange-600',
    articles: [
      { title: 'Comentarios y comunicación', views: 1100, rating: 4.6 },
      { title: 'Asignación de tickets', views: 900, rating: 4.4 },
      { title: 'Seguimiento de progreso', views: 700, rating: 4.2 }
    ]
  }
]

const popularArticles = [
  { title: 'Cómo crear un ticket efectivo', category: 'Tickets', views: 3200, rating: 4.9 },
  { title: 'Entendiendo las prioridades', category: 'Tickets', views: 2800, rating: 4.8 },
  { title: 'Configurar notificaciones por email', category: 'Cuenta', views: 2400, rating: 4.7 },
  { title: 'Adjuntar archivos grandes', category: 'Tickets', views: 2100, rating: 4.6 },
  { title: 'Cambiar mi contraseña', category: 'Cuenta', views: 1900, rating: 4.5 }
]

export default function HelpCenterPage() {
  const { data: session } = useSession()
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

  return (
    <RoleDashboardLayout
      title='Centro de Ayuda'
      subtitle='Encuentra respuestas rápidas a tus preguntas'
    >
      <div className='max-w-6xl mx-auto space-y-8'>
        {/* Búsqueda */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-3 bg-blue-100 rounded-full">
                  <HelpCircle className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">¿En qué podemos ayudarte?</h2>
                <p className="text-muted-foreground mt-2">Busca en nuestra base de conocimientos</p>
              </div>
              <div className="max-w-2xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                  <Input
                    placeholder="Buscar artículos, guías, tutoriales..."
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

        {/* Accesos Rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="p-3 bg-green-100 rounded-full">
                    <MessageCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <h3 className="font-semibold">Contactar Soporte</h3>
                <p className="text-sm text-muted-foreground">Habla directamente con nuestro equipo</p>
                {config?.chatEnabled && config.chatUrl ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={config.chatUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Chat
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/help/contact">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Contactar
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="p-3 bg-purple-100 rounded-full">
                    <Video className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <h3 className="font-semibold">Video Tutoriales</h3>
                <p className="text-sm text-muted-foreground">Aprende viendo paso a paso</p>
                <Button variant="outline" size="sm" asChild>
                  <a href={config?.videoTutorialsUrl || '#'} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Videos
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="p-3 bg-orange-100 rounded-full">
                    <FileText className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <h3 className="font-semibold">Documentación</h3>
                <p className="text-sm text-muted-foreground">Guías técnicas detalladas</p>
                <Button variant="outline" size="sm" asChild>
                  <a href={config?.documentationUrl || '#'} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Leer Docs
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Categorías de Ayuda */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-6">Categorías de Ayuda</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {helpCategories.map((category) => {
              const Icon = category.icon
              return (
                <Card key={category.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${category.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span>{category.title}</span>
                    </CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {category.articles.map((article, index) => (
                        <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-foreground">{article.title}</h4>
                            <div className="flex items-center space-x-3 mt-1">
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 mr-1" />
                                {article.views} vistas
                              </div>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Star className="h-3 w-3 mr-1 fill-current text-yellow-400" />
                                {article.rating}
                              </div>
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Artículos Populares */}
        <Card>
          <CardHeader>
            <CardTitle>Artículos Más Populares</CardTitle>
            <CardDescription>Los artículos más consultados por la comunidad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {popularArticles.map((article, index) => (
                <div key={index} className="flex items-center justify-between p-3 hover:bg-muted rounded cursor-pointer">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{article.title}</h4>
                      <div className="flex items-center space-x-4 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {article.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{article.views} vistas</span>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Star className="h-3 w-3 mr-1 fill-current text-yellow-400" />
                          {article.rating}
                        </div>
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer de Ayuda */}
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold text-foreground">¿No encontraste lo que buscabas?</h3>
              <p className="text-muted-foreground">Nuestro equipo de soporte está aquí para ayudarte</p>
              <div className="flex justify-center space-x-4">
                <Button asChild>
                  <Link href="/help/contact">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Contactar Soporte
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/tickets/create">
                    <FileText className="h-4 w-4 mr-2" />
                    Crear Ticket
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}