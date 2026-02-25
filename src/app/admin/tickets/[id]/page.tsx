'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Clock,
  User,
  Tag,
  MessageSquare,
  Paperclip,
  History,
  Edit,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  Lightbulb,
  BookOpen,
} from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { AutoAssignment } from '@/components/tickets/auto-assignment'
import { FileUpload } from '@/components/tickets/file-upload'
import { TicketTimeline } from '@/components/ui/ticket-timeline'
import { TicketRatingSystem } from '@/components/ui/ticket-rating-system'
import { TicketResolutionTracker } from '@/components/ui/ticket-resolution-tracker'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  useTicketData, 
  useUserData, 
  useCategoryData,
  type Ticket,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  formatTimeAgo,
  formatDate,
  getStatusConfig,
  getPriorityConfig
} from '@/hooks/use-ticket-data'

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { getTicket, updateTicket, loading } = useTicketData()
  const { getTechnicians } = useUserData()
  const { getCategories } = useCategoryData()
  
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [technicians, setTechnicians] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: '' as Ticket['status'],
    priority: '' as Ticket['priority'],
    assigneeId: '',
    categoryId: '',
  })
  
  // Estados para selección en cascada de categorías
  const [selectedCategories, setSelectedCategories] = useState<{
    level1?: string
    level2?: string
    level3?: string
    level4?: string
  }>({})
  const [availableCategories, setAvailableCategories] = useState<{
    level1: any[]
    level2: any[]
    level3: any[]
    level4: any[]
  }>({
    level1: [],
    level2: [],
    level3: [],
    level4: []
  })

  useEffect(() => {
    // No intentar cargar ticket si la ruta es "create"
    if (params.id && params.id !== 'create') {
      loadTicket()
      loadTechnicians()
      loadCategories()
    }
  }, [params.id])
  
  // Construir jerarquía cuando se cargan las categorías
  useEffect(() => {
    if (categories.length > 0 && ticket?.category?.id) {
      buildCategoryHierarchy(ticket.category.id, categories)
    }
  }, [categories, ticket?.category?.id])

  const loadTicket = async () => {
    // Validación adicional
    if (!params.id || params.id === 'create') {
      return
    }
    
    const ticketData = await getTicket(params.id as string)
    if (ticketData) {
      setTicket(ticketData)
      setEditForm({
        title: ticketData.title,
        description: ticketData.description,
        status: ticketData.status,
        priority: ticketData.priority,
        assigneeId: ticketData.assignee?.id || '',
        categoryId: ticketData.category.id,
      })
      
      // Construir la jerarquía de categorías si ya tenemos las categorías cargadas
      if (categories.length > 0) {
        buildCategoryHierarchy(ticketData.category.id, categories)
      }
    }
  }

  const loadTechnicians = async () => {
    const technicianData = await getTechnicians()
    setTechnicians(technicianData)
  }

  const loadCategories = async () => {
    const categoryData = await getCategories({ isActive: true })
    setCategories(categoryData)
  }
  
  // Función para construir la jerarquía de categorías desde una categoría específica
  const buildCategoryHierarchy = (categoryId: string, allCategories: any[]) => {
    const findCategoryPath = (catId: string, cats: any[], path: string[] = []): string[] | null => {
      for (const cat of cats) {
        if (cat.id === catId) {
          return [...path, cat.id]
        }
        if (cat.children && cat.children.length > 0) {
          const found = findCategoryPath(catId, cat.children, [...path, cat.id])
          if (found) return found
        }
      }
      return null
    }
    
    const path = findCategoryPath(categoryId, allCategories)
    if (!path) return
    
    // Configurar las selecciones basadas en el path
    const newSelections: any = {}
    const newAvailable: any = {
      level1: allCategories.filter(c => c.level === 1),
      level2: [],
      level3: [],
      level4: []
    }
    
    path.forEach((catId, index) => {
      const level = index + 1
      newSelections[`level${level}`] = catId
      
      // Encontrar la categoría para obtener sus hijos
      const findCat = (cats: any[]): any => {
        for (const cat of cats) {
          if (cat.id === catId) return cat
          if (cat.children) {
            const found = findCat(cat.children)
            if (found) return found
          }
        }
        return null
      }
      
      const cat = findCat(allCategories)
      if (cat && cat.children && level < 4) {
        newAvailable[`level${level + 1}`] = cat.children
      }
    })
    
    setSelectedCategories(newSelections)
    setAvailableCategories(newAvailable)
  }
  
  // Manejar selección de categoría en cascada
  const handleCategorySelect = (level: number, categoryId: string) => {
    const findCategory = (cats: any[], id: string): any | null => {
      for (const cat of cats) {
        if (cat.id === id) return cat
        if (cat.children && cat.children.length > 0) {
          const found = findCategory(cat.children, id)
          if (found) return found
        }
      }
      return null
    }

    const selectedCat = findCategory(categories, categoryId)
    if (!selectedCat) return

    // Actualizar selecciones
    const newSelections = { ...selectedCategories }
    
    if (level === 1) {
      newSelections.level1 = categoryId
      newSelections.level2 = undefined
      newSelections.level3 = undefined
      newSelections.level4 = undefined
      
      setAvailableCategories(prev => ({
        ...prev,
        level2: selectedCat.children || [],
        level3: [],
        level4: []
      }))
    } else if (level === 2) {
      newSelections.level2 = categoryId
      newSelections.level3 = undefined
      newSelections.level4 = undefined
      
      setAvailableCategories(prev => ({
        ...prev,
        level3: selectedCat.children || [],
        level4: []
      }))
    } else if (level === 3) {
      newSelections.level3 = categoryId
      newSelections.level4 = undefined
      
      setAvailableCategories(prev => ({
        ...prev,
        level4: selectedCat.children || []
      }))
    } else if (level === 4) {
      newSelections.level4 = categoryId
    }

    setSelectedCategories(newSelections)
    
    // Actualizar el valor del formulario con la categoría más específica seleccionada
    const finalCategoryId = newSelections.level4 || newSelections.level3 || newSelections.level2 || newSelections.level1
    if (finalCategoryId) {
      setEditForm({ ...editForm, categoryId: finalCategoryId })
    }
  }

  const handleSave = async () => {
    if (!ticket) return

    const updatedTicket = await updateTicket(ticket.id, {
      ...editForm,
      assigneeId: editForm.assigneeId || undefined,
    } as any)

    if (updatedTicket) {
      setIsEditing(false)
      loadTicket()
    }
  }

  const getStatusBadge = (status: Ticket['status']) => {
    const statusConfig = getStatusConfig(status)
    if (!statusConfig) return null

    return (
      <Badge className={statusConfig.color}>
        {statusConfig.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: Ticket['priority']) => {
    const priorityConfig = getPriorityConfig(priority)
    if (!priorityConfig) return null

    return <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
  }

  if (loading) {
    return (
      <RoleDashboardLayout title='Cargando...' subtitle='Obteniendo información del ticket'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
            <p className='mt-2 text-muted-foreground'>Cargando ticket...</p>
          </div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!ticket) {
    return (
      <RoleDashboardLayout title='Ticket no encontrado' subtitle='El ticket solicitado no existe'>
        <div className='text-center py-8'>
          <p className='text-muted-foreground'>Ticket no encontrado</p>
          <Button onClick={() => router.back()} className='mt-4'>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Volver
          </Button>
        </div>
      </RoleDashboardLayout>
    )
  }

  const headerActions = (
    <div className='flex flex-wrap items-center gap-2'>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='outline' size='sm' onClick={() => router.push('/admin/tickets')}>
              <ArrowLeft className='h-4 w-4 mr-2' />
              <span className='hidden sm:inline'>Todos los Tickets</span>
              <span className='sm:hidden'>Tickets</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Volver a la lista de todos los tickets</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {/* Botón Inteligente de Artículo (solo si ticket está RESOLVED) - TEMPORALMENTE DESHABILITADO */}
      {/* {ticket.status === 'RESOLVED' && (
        ticket.knowledge_article ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => router.push(`/admin/knowledge/${ticket.knowledge_article.id}`)}
                >
                  <BookOpen className='h-4 w-4 mr-2' />
                  <span className='hidden sm:inline'>Ver Artículo</span>
                  <span className='sm:hidden'>Artículo</span>
                  {!ticket.knowledge_article.isPublished && (
                    <Badge variant='secondary' className='ml-2 text-xs'>Borrador</Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ver el artículo de conocimiento creado desde este ticket</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => router.push(`/admin/knowledge/new?fromTicket=${ticket.id}`)}
                >
                  <Lightbulb className='h-4 w-4 mr-2' />
                  <span className='hidden sm:inline'>Crear Artículo</span>
                  <span className='sm:hidden'>Artículo</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Crea un artículo de conocimiento con la solución de este ticket</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      )} */}
      {getStatusBadge(ticket.status)}
      {getPriorityBadge(ticket.priority)}
      {session?.user?.role === 'ADMIN' && (
        <>
          <AutoAssignment
            ticketId={ticket.id}
            currentAssignee={ticket.assignee}
            onAssignmentComplete={loadTicket}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isEditing ? 'outline' : 'default'}
                  size='sm'
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false)
                      setEditForm({
                        title: ticket.title,
                        description: ticket.description,
                        status: ticket.status,
                        priority: ticket.priority,
                        assigneeId: ticket.assignee?.id || '',
                        categoryId: ticket.category.id,
                      })
                    } else {
                      setIsEditing(true)
                    }
                  }}
                >
                  {isEditing ? (
                    <>
                      <X className='h-4 w-4 sm:mr-2' />
                      <span className='hidden sm:inline'>Cancelar</span>
                    </>
                  ) : (
                    <>
                      <Edit className='h-4 w-4 sm:mr-2' />
                      <span className='hidden sm:inline'>Editar</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isEditing ? 'Cancelar edición y descartar cambios' : 'Editar información del ticket'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      )}
      {isEditing && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size='sm' onClick={handleSave}>
                <Save className='h-4 w-4 sm:mr-2' />
                <span className='hidden sm:inline'>Guardar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Guarda los cambios realizados al ticket</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )

  return (
    <RoleDashboardLayout
      title={`Ticket #${ticket.id.slice(-8)}`}
      subtitle={`Creado ${formatDate(ticket.createdAt)}`}
      headerActions={headerActions}
    >
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Contenido principal */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Información del ticket */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Ticket</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <Label htmlFor='title'>Título</Label>
                {isEditing ? (
                  <Input
                    id='title'
                    value={editForm.title}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  />
                ) : (
                  <p className='text-lg font-medium'>{ticket.title}</p>
                )}
              </div>

              <div>
                <Label htmlFor='description'>Descripción</Label>
                {isEditing ? (
                  <Textarea
                    id='description'
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    rows={4}
                  />
                ) : (
                  <p className='text-foreground whitespace-pre-wrap'>{ticket.description}</p>
                )}
              </div>

              {isEditing && (
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='status'>Estado</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value) => setEditForm({ ...editForm, status: value as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "ON_HOLD" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_STATUSES.map(status => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor='priority'>Prioridad</Label>
                    <Select
                      value={editForm.priority}
                      onValueChange={(value) => setEditForm({ ...editForm, priority: value as "LOW" | "MEDIUM" | "HIGH" | "URGENT" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_PRIORITIES.map(priority => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs para organizar el contenido */}
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="timeline">Historial</TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cronología completa de actividades y cambios</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="resolution">Plan de Resolución</TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Gestiona las tareas para resolver este ticket</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="rating">Calificación</TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Calificación del cliente y estadísticas del técnico</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="files">Archivos</TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Archivos adjuntos del ticket</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TabsList>
            
            <TabsContent value="timeline" className="space-y-4">
              <TicketTimeline 
                ticketId={ticket.id}
                canAddComments={session?.user?.role === 'ADMIN' || session?.user?.role === 'TECHNICIAN'}
                canViewInternal={session?.user?.role === 'ADMIN' || session?.user?.role === 'TECHNICIAN'}
              />
            </TabsContent>
            
            <TabsContent value="resolution" className="space-y-4">
              <TicketResolutionTracker 
                ticketId={ticket.id}
                canEdit={session?.user?.role === 'ADMIN' || 
                  (session?.user?.role === 'TECHNICIAN' && ticket.assignee?.id === session?.user?.id)}
                mode={session?.user?.role === 'ADMIN' ? 'admin' : 'technician'}
              />
            </TabsContent>
            
            <TabsContent value="rating" className="space-y-4">
              <TicketRatingSystem 
                ticketId={ticket.id}
                technicianId={ticket.assignee?.id}
                canRate={session?.user?.id === ticket.client.id && 
                  (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')}
                showTechnicianStats={session?.user?.role === 'ADMIN'}
                mode={session?.user?.role === 'ADMIN' ? 'admin' : 'client'}
              />
            </TabsContent>
            
            <TabsContent value="files" className="space-y-4">
              <FileUpload 
                ticketId={ticket.id} 
                onUploadComplete={loadTicket} 
                disabled={ticket.status === 'CLOSED'} 
              />
              
              {/* Lista de archivos existentes */}
              {ticket.attachments && ticket.attachments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center'>
                      <Paperclip className='h-5 w-5 mr-2' />
                      Archivos Adjuntos ({ticket.attachments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-2'>
                      {ticket.attachments.map(attachment => (
                        <div
                          key={attachment.id}
                          className='flex items-center justify-between p-3 bg-muted rounded-lg'
                        >
                          <div className="flex items-center space-x-3">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className='text-sm font-medium'>{attachment.originalName}</p>
                              <p className='text-xs text-muted-foreground'>
                                {(attachment.size / 1024).toFixed(1)} KB • {formatDate(attachment.createdAt)}
                              </p>
                            </div>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant='outline' size='sm'>
                                  Descargar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Descarga el archivo {attachment.originalName}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Detalles */}
          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center space-x-3'>
                <User className='h-4 w-4 text-muted-foreground' />
                <div>
                  <p className='text-sm font-medium'>Cliente</p>
                  <p className='text-sm text-muted-foreground'>{ticket.client.name}</p>
                  <p className='text-xs text-muted-foreground'>{ticket.client.email}</p>
                  {ticket.client.department && (
                    <Badge 
                      variant="outline" 
                      className='text-xs mt-1'
                      style={{ 
                        borderColor: (ticket.client.department as any)?.color || '#6B7280',
                        color: (ticket.client.department as any)?.color || '#6B7280'
                      }}
                    >
                      {typeof ticket.client.department === 'string' 
                        ? ticket.client.department 
                        : (ticket.client.department as any)?.name || 'Sin departamento'}
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              <div className='flex items-center space-x-3'>
                <User className='h-4 w-4 text-muted-foreground' />
                <div className='flex-1'>
                  <p className='text-sm font-medium'>Asignado a</p>
                  {isEditing ? (
                    <Select
                      value={editForm.assigneeId || 'unassigned'}
                      onValueChange={value => setEditForm({ ...editForm, assigneeId: value === 'unassigned' ? '' : value })}
                    >
                      <SelectTrigger className='mt-1'>
                        <SelectValue placeholder='Seleccionar técnico' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='unassigned'>Sin asignar</SelectItem>
                        {technicians.map(tech => (
                          <SelectItem key={tech.id} value={tech.id}>
                            {tech.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : ticket.assignee ? (
                    <>
                      <p className='text-sm text-muted-foreground'>{ticket.assignee.name}</p>
                      <p className='text-xs text-muted-foreground'>{ticket.assignee.email}</p>
                    </>
                  ) : (
                    <p className='text-sm text-muted-foreground'>Sin asignar</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className='flex items-center space-x-3'>
                <Tag className='h-4 w-4 text-muted-foreground' />
                <div className='flex-1'>
                  <p className='text-sm font-medium'>Categoría</p>
                  {isEditing ? (
                    <div className='space-y-3 mt-2'>
                      {/* Nivel 1 - Categoría Principal */}
                      <div className='space-y-2'>
                        <Label htmlFor='category-level-1' className='text-xs font-medium'>
                          1. Categoría Principal
                        </Label>
                        <Select 
                          value={selectedCategories.level1 || ''} 
                          onValueChange={(value) => handleCategorySelect(1, value)}
                        >
                          <SelectTrigger className='h-8 text-xs'>
                            <SelectValue placeholder='Selecciona la categoría principal' />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCategories.level1.map((category: any) => (
                              <SelectItem key={category.id} value={category.id}>
                                <div className='flex items-center space-x-2'>
                                  <div
                                    className='w-2 h-2 rounded-full flex-shrink-0'
                                    style={{ backgroundColor: category.color }}
                                  />
                                  <span className='text-xs'>{category.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Nivel 2 - Subcategoría */}
                      {selectedCategories.level1 && availableCategories.level2.length > 0 && (
                        <div className='space-y-2 pl-3 border-l-2 border-blue-200'>
                          <Label htmlFor='category-level-2' className='text-xs font-medium'>
                            2. Subcategoría
                          </Label>
                          <Select 
                            value={selectedCategories.level2 || ''} 
                            onValueChange={(value) => handleCategorySelect(2, value)}
                          >
                            <SelectTrigger className='h-8 text-xs'>
                              <SelectValue placeholder='Selecciona la subcategoría' />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCategories.level2.map((category: any) => (
                                <SelectItem key={category.id} value={category.id}>
                                  <div className='flex items-center space-x-2'>
                                    <div
                                      className='w-2 h-2 rounded-full flex-shrink-0'
                                      style={{ backgroundColor: category.color }}
                                    />
                                    <span className='text-xs'>{category.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Nivel 3 - Especialidad */}
                      {selectedCategories.level2 && availableCategories.level3.length > 0 && (
                        <div className='space-y-2 pl-6 border-l-2 border-green-200'>
                          <Label htmlFor='category-level-3' className='text-xs font-medium'>
                            3. Especialidad
                          </Label>
                          <Select 
                            value={selectedCategories.level3 || ''} 
                            onValueChange={(value) => handleCategorySelect(3, value)}
                          >
                            <SelectTrigger className='h-8 text-xs'>
                              <SelectValue placeholder='Selecciona la especialidad' />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCategories.level3.map((category: any) => (
                                <SelectItem key={category.id} value={category.id}>
                                  <div className='flex items-center space-x-2'>
                                    <div
                                      className='w-2 h-2 rounded-full flex-shrink-0'
                                      style={{ backgroundColor: category.color }}
                                    />
                                    <span className='text-xs'>{category.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Nivel 4 - Detalle */}
                      {selectedCategories.level3 && availableCategories.level4.length > 0 && (
                        <div className='space-y-2 pl-9 border-l-2 border-purple-200'>
                          <Label htmlFor='category-level-4' className='text-xs font-medium'>
                            4. Detalle Específico
                          </Label>
                          <Select 
                            value={selectedCategories.level4 || ''} 
                            onValueChange={(value) => handleCategorySelect(4, value)}
                          >
                            <SelectTrigger className='h-8 text-xs'>
                              <SelectValue placeholder='Selecciona el detalle específico' />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCategories.level4.map((category: any) => (
                                <SelectItem key={category.id} value={category.id}>
                                  <div className='flex items-center space-x-2'>
                                    <div
                                      className='w-2 h-2 rounded-full flex-shrink-0'
                                      style={{ backgroundColor: category.color }}
                                    />
                                    <span className='text-xs'>{category.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      {/* Ruta de navegación */}
                      {selectedCategories.level1 && (
                        <div className='p-2 bg-muted rounded text-xs text-muted-foreground'>
                          <strong>Ruta:</strong>{' '}
                          {availableCategories.level1.find((c: any) => c.id === selectedCategories.level1)?.name}
                          {selectedCategories.level2 && (
                            <> → {availableCategories.level2.find((c: any) => c.id === selectedCategories.level2)?.name}</>
                          )}
                          {selectedCategories.level3 && (
                            <> → {availableCategories.level3.find((c: any) => c.id === selectedCategories.level3)?.name}</>
                          )}
                          {selectedCategories.level4 && (
                            <> → {availableCategories.level4.find((c: any) => c.id === selectedCategories.level4)?.name}</>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className='flex items-center space-x-2 mt-1'>
                      <div
                        className='w-3 h-3 rounded-full'
                        style={{ backgroundColor: ticket.category.color }}
                      />
                      <span className='text-sm text-muted-foreground'>{ticket.category.name}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className='flex items-center space-x-3'>
                <Clock className='h-4 w-4 text-muted-foreground' />
                <div>
                  <p className='text-sm font-medium'>Fechas</p>
                  <p className='text-xs text-muted-foreground'>Creado: {formatDate(ticket.createdAt)}</p>
                  <p className='text-xs text-muted-foreground'>
                    Actualizado: {formatDate(ticket.updatedAt)}
                  </p>
                  {ticket.resolvedAt && (
                    <p className='text-xs text-muted-foreground'>
                      Resuelto: {formatDate(ticket.resolvedAt)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Historial */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <History className='h-5 w-5 mr-2' />
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-3 max-h-60 overflow-y-auto'>
                {ticket.history && ticket.history.length > 0 ? (
                  <>
                    {ticket.history.slice(0, 5).map(entry => (
                      <div key={entry.id} className='text-sm'>
                        <div className='flex items-center justify-between'>
                          <span className='font-medium'>{entry.user.name}</span>
                          <span className='text-xs text-muted-foreground'>{formatTimeAgo(entry.createdAt)}</span>
                        </div>
                        <p className='text-muted-foreground'>{entry.comment}</p>
                      </div>
                    ))}
                    {ticket.history.length > 5 && (
                      <p className='text-xs text-muted-foreground text-center pt-2'>
                        Ver historial completo en la pestaña "Historial"
                      </p>
                    )}
                  </>
                ) : (
                  <p className='text-sm text-muted-foreground text-center py-4'>
                    No hay actividad reciente
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
