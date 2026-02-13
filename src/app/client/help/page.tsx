'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  HelpCircle,
  Search,
  BookOpen,
  MessageSquare,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Video,
  FileText,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FAQItem {
  id: string
  question: string
  answer: string
  category: string
  helpful: number
}

const faqCategories = [
  { id: 'getting-started', name: 'Primeros Pasos', icon: Zap },
  { id: 'tickets', name: 'Tickets', icon: FileText },
  { id: 'account', name: 'Cuenta', icon: HelpCircle },
  { id: 'technical', name: 'Técnico', icon: BookOpen },
]

const faqData: FAQItem[] = [
  {
    id: '1',
    question: '¿Cómo creo un nuevo ticket?',
    answer:
      'Para crear un nuevo ticket, haz clic en el botón "Crear Ticket" en el dashboard o en la navegación lateral. Completa el formulario con el título, descripción, categoría y prioridad. Puedes adjuntar archivos si es necesario. Una vez enviado, recibirás una confirmación por email.',
    category: 'getting-started',
    helpful: 45,
  },
  {
    id: '2',
    question: '¿Cuánto tiempo tarda en responderse un ticket?',
    answer:
      'El tiempo de respuesta depende de la prioridad del ticket. Los tickets urgentes se responden en menos de 2 horas, los de alta prioridad en 4 horas, los de prioridad media en 8 horas, y los de baja prioridad en 24 horas. Estos son tiempos promedio y pueden variar según la carga de trabajo.',
    category: 'tickets',
    helpful: 38,
  },
  {
    id: '3',
    question: '¿Cómo puedo ver el estado de mis tickets?',
    answer:
      'Puedes ver todos tus tickets en la sección "Mis Tickets" del menú. Allí encontrarás el estado actual (Abierto, En Progreso, Resuelto, Cerrado), el técnico asignado, y la última actualización. También recibirás notificaciones por email cuando haya cambios.',
    category: 'tickets',
    helpful: 42,
  },
  {
    id: '4',
    question: '¿Cómo cambio mi contraseña?',
    answer:
      'Ve a tu perfil haciendo clic en tu avatar en la esquina superior derecha, luego selecciona "Mi Perfil". En la sección de Seguridad encontrarás la opción "Cambiar Contraseña". Necesitarás tu contraseña actual para confirmar el cambio.',
    category: 'account',
    helpful: 31,
  },
  {
    id: '5',
    question: '¿Puedo adjuntar archivos a un ticket?',
    answer:
      'Sí, puedes adjuntar archivos al crear un ticket o al agregar comentarios. Los formatos permitidos son: imágenes (JPG, PNG, GIF), documentos (PDF, DOC, DOCX), y archivos comprimidos (ZIP, RAR). El tamaño máximo por archivo es de 10MB.',
    category: 'tickets',
    helpful: 29,
  },
  {
    id: '6',
    question: '¿Cómo actualizo mi información de contacto?',
    answer:
      'Ve a "Mi Perfil" desde el menú de usuario. Haz clic en "Editar" y actualiza tu nombre, teléfono, empresa o dirección. No olvides hacer clic en "Guardar" para aplicar los cambios. El correo electrónico no se puede cambiar por seguridad.',
    category: 'account',
    helpful: 25,
  },
  {
    id: '7',
    question: '¿Qué significan las prioridades de los tickets?',
    answer:
      'Urgente: Problemas críticos que bloquean operaciones. Alta: Problemas importantes que afectan funcionalidad. Media: Problemas que causan inconvenientes menores. Baja: Consultas generales o mejoras sugeridas.',
    category: 'getting-started',
    helpful: 36,
  },
  {
    id: '8',
    question: '¿Cómo puedo calificar el servicio recibido?',
    answer:
      'Una vez que tu ticket sea resuelto, recibirás un email con un enlace para calificar el servicio. También puedes calificar desde la página del ticket haciendo clic en "Calificar Servicio". Tu feedback nos ayuda a mejorar.',
    category: 'tickets',
    helpful: 22,
  },
]

export default function ClientHelpPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'CLIENT') {
      router.push('/unauthorized')
      return
    }
  }, [session, router])

  const filteredFAQs = faqData.filter((faq) => {
    const matchesSearch =
      searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || faq.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id)
  }

  return (
    <RoleDashboardLayout
      title="Centro de Ayuda"
      subtitle="Encuentra respuestas y recursos útiles"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Search Bar */}
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar en la ayuda..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Guías y Tutoriales
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Aprende a usar el sistema paso a paso
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Video className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Videos Tutoriales
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Mira videos explicativos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Contactar Soporte
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Habla con nuestro equipo
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Categories Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Categorías</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant={selectedCategory === null ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(null)}
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Todas
                </Button>
                {faqCategories.map((category) => {
                  const Icon = category.icon
                  const count = faqData.filter((faq) => faq.category === category.id).length
                  return (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {category.name}
                      <Badge variant="secondary" className="ml-auto">
                        {count}
                      </Badge>
                    </Button>
                  )
                })}
              </CardContent>
            </Card>

            {/* Contact Card */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">¿Necesitas más ayuda?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Email</p>
                    <p className="text-muted-foreground">support@example.com</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Teléfono</p>
                    <p className="text-muted-foreground">+1 (555) 123-4567</p>
                  </div>
                </div>
                <Button className="w-full mt-4">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Iniciar Chat
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* FAQ List */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Preguntas Frecuentes</CardTitle>
                <CardDescription>
                  {filteredFAQs.length} pregunta{filteredFAQs.length !== 1 ? 's' : ''}{' '}
                  {searchQuery && `encontrada${filteredFAQs.length !== 1 ? 's' : ''}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredFAQs.length === 0 ? (
                  <div className="text-center py-12">
                    <HelpCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No se encontraron resultados
                    </h3>
                    <p className="text-muted-foreground">
                      Intenta con otros términos de búsqueda
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFAQs.map((faq) => (
                      <div
                        key={faq.id}
                        className="border border-border rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() => toggleFAQ(faq.id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-muted transition-colors"
                        >
                          <div className="flex items-start space-x-3 text-left">
                            <HelpCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <h3 className="font-semibold text-foreground">
                                {faq.question}
                              </h3>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {
                                    faqCategories.find((c) => c.id === faq.category)
                                      ?.name
                                  }
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {faq.helpful} personas encontraron esto útil
                                </span>
                              </div>
                            </div>
                          </div>
                          {expandedFAQ === faq.id ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>

                        {expandedFAQ === faq.id && (
                          <div className="p-4 pt-0 border-t bg-muted/50">
                            <p className="text-sm text-foreground leading-relaxed mb-4">
                              {faq.answer}
                            </p>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-muted-foreground">
                                ¿Te fue útil?
                              </span>
                              <Button variant="outline" size="sm">
                                Sí
                              </Button>
                              <Button variant="outline" size="sm">
                                No
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
