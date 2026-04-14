'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
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
import Link from 'next/link'

interface FAQ {
  id: string
  question: string
  answer: string
  category: string
  icon: any
}

const faqs: FAQ[] = [
  {
    id: '1',
    question: '¿Cómo creo un nuevo ticket?',
    answer:
      'Para crear un nuevo ticket, haz clic en el botón "Crear Ticket" en el menú principal o en tu dashboard. Completa el formulario con el título, una descripción detallada de tu problema o solicitud, selecciona el área correspondiente, la categoría y la prioridad. Puedes adjuntar archivos si es necesario. Una vez enviado, recibirás una confirmación y podrás hacer seguimiento desde "Mis Tickets".',
    category: 'Primeros Pasos',
    icon: Zap,
  },
  {
    id: '2',
    question: '¿Cómo puedo ver el estado de mis tickets?',
    answer:
      'Puedes ver todos tus tickets en la sección "Mis Tickets" del menú principal. Allí encontrarás una lista con el estado actual de cada ticket (Abierto, En Progreso, Resuelto, Cerrado). Haz clic en cualquier ticket para ver los detalles completos, el historial de cambios y las respuestas del equipo de soporte.',
    category: 'Gestión de Tickets',
    icon: FileText,
  },
  {
    id: '3',
    question: '¿Qué significan los diferentes estados de un ticket?',
    answer:
      'Los estados de un ticket son: OPEN (recién creado, esperando asignación), IN_PROGRESS (el equipo está trabajando en él), RESOLVED (la solicitud ha sido atendida, esperando tu confirmación), CLOSED (ticket finalizado). También existe PENDING para tickets que esperan información adicional de tu parte.',
    category: 'Gestión de Tickets',
    icon: FileText,
  },
  {
    id: '4',
    question: '¿Cómo puedo responder o agregar información a un ticket?',
    answer:
      'Abre el ticket desde "Mis Tickets" y encontrarás un área de comentarios en la parte inferior. Escribe tu mensaje, puedes adjuntar archivos si es necesario, y haz clic en "Enviar Comentario". El responsable asignado recibirá una notificación inmediata de tu respuesta.',
    category: 'Gestión de Tickets',
    icon: MessageSquare,
  },
  {
    id: '5',
    question: '¿Puedo cambiar la prioridad de mi ticket?',
    answer:
      'No, los clientes no pueden cambiar la prioridad de un ticket una vez creado. Sin embargo, si consideras que tu solicitud requiere atención urgente, puedes agregar un comentario explicando la situación y el equipo evaluará si es necesario ajustar la prioridad.',
    category: 'Gestión de Tickets',
    icon: FileText,
  },
  {
    id: '6',
    question: '¿Cómo configuro mis notificaciones?',
    answer:
      'Ve a "Configuración" en el menú principal, luego a la sección "Notificaciones". Allí puedes activar o desactivar notificaciones por email, elegir qué tipos de eventos quieres recibir (actualizaciones de tickets, nuevos comentarios, cambios de estado) y ajustar tus preferencias según tus necesidades.',
    category: 'Configuración de Cuenta',
    icon: HelpCircle,
  },
  {
    id: '7',
    question: '¿Cómo actualizo mi información personal?',
    answer:
      'En "Configuración", sección "Personal", puedes actualizar tu nombre, email, teléfono y otros datos de contacto. También puedes cambiar tu contraseña y configurar tus preferencias de tema (claro/oscuro). Recuerda guardar los cambios antes de salir.',
    category: 'Configuración de Cuenta',
    icon: HelpCircle,
  },
  {
    id: '8',
    question: '¿Qué hago si olvidé mi contraseña?',
    answer:
      'En la página de inicio de sesión, haz clic en "¿Olvidaste tu contraseña?". Ingresa tu email registrado y recibirás un enlace para restablecer tu contraseña. El enlace es válido por 24 horas. Si no recibes el email, verifica tu carpeta de spam o contacta al administrador.',
    category: 'Configuración de Cuenta',
    icon: HelpCircle,
  },
]

export default function ClientHelpPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

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

  const categories = Array.from(new Set(faqs.map((faq) => faq.category)))

  const filteredFaqs = faqs.filter((faq) => {
    const matchesSearch =
      searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || faq.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id)
  }

  return (
    <RoleDashboardLayout
      title="Centro de Ayuda"
      subtitle="Encuentra respuestas y recursos útiles"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <BackToTickets />
        {/* Search Bar */}
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar en preguntas frecuentes..."
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
            <Link href="/client/tickets/create">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      Crear Ticket
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      ¿No encuentras la respuesta? Contacta con soporte
                    </p>
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link href="/client/tickets">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <FileText className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      Mis Tickets
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Ver el estado de tus solicitudes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link href="/settings">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <HelpCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      Configuración
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Personaliza tu cuenta y notificaciones
                    </p>
                  </div>
                </div>
              </CardContent>
            </Link>
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
                  <Badge variant="secondary" className="ml-auto">
                    {faqs.length}
                  </Badge>
                </Button>
                {categories.map((category) => {
                  const count = faqs.filter((faq) => faq.category === category).length
                  const Icon = category === 'Primeros Pasos' ? Zap : category === 'Gestión de Tickets' ? FileText : HelpCircle
                  return (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(category)}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {category}
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
                <p className="text-sm text-muted-foreground mb-4">
                  Si no encuentras la respuesta que buscas, nuestro equipo de soporte está listo para ayudarte.
                </p>
                <Button className="w-full" asChild>
                  <Link href="/client/tickets/create">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Contactar Soporte
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* FAQs List */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Preguntas Frecuentes</CardTitle>
                <CardDescription>
                  {filteredFaqs.length} pregunta{filteredFaqs.length !== 1 ? 's' : ''}{' '}
                  {searchQuery && `encontrada${filteredFaqs.length !== 1 ? 's' : ''}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-12">
                    <HelpCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No se encontraron resultados
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Intenta con otros términos de búsqueda o explora todas las categorías
                    </p>
                    <Button onClick={() => setSearchQuery('')}>
                      Ver todas las preguntas
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFaqs.map((faq) => {
                      const Icon = faq.icon
                      return (
                        <div
                          key={faq.id}
                          className="border border-border rounded-lg overflow-hidden"
                        >
                          <button
                            onClick={() => toggleFaq(faq.id)}
                            className="w-full p-4 flex items-center justify-between hover:bg-muted transition-colors"
                          >
                            <div className="flex items-start space-x-3 text-left">
                              <Icon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <h3 className="font-semibold text-foreground">
                                  {faq.question}
                                </h3>
                                <Badge variant="secondary" className="mt-2 text-xs">
                                  {faq.category}
                                </Badge>
                              </div>
                            </div>
                            {expandedFaq === faq.id ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            )}
                          </button>

                          {expandedFaq === faq.id && (
                            <div className="p-4 pt-0 border-t bg-muted/50">
                              <p className="text-sm text-foreground leading-relaxed">
                                {faq.answer}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
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
