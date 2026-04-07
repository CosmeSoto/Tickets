'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { createTicketSchema, CreateTicketData } from '@/lib/schemas/ticket-schemas'
import { TicketPriority } from '@prisma/client'
import { 
  Ticket, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  ArrowLeft, 
  User, 
  Tag,
  FileText,
  Zap,
  Info,
  Upload,
  File,
  X,
  Paperclip
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { UserCombobox } from '@/components/ui/user-combobox'
import { CategorySelectorWrapper } from '@/features/category-selection'

interface User {
  id: string
  name: string
  email: string
  role: string
  department?: {
    id: string
    name: string
    color: string
  }
}

const priorityLabels = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const priorityColors = {
  LOW: 'bg-green-100 text-green-800 border-green-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  URGENT: 'bg-red-100 text-red-800 border-red-200',
}

const priorityDescriptions = {
  LOW: 'Para consultas generales o mejoras no urgentes',
  MEDIUM: 'Para problemas que afectan el trabajo pero tienen soluciones alternativas',
  HIGH: 'Para problemas que impactan significativamente el trabajo',
  URGENT: 'Para problemas críticos que bloquean completamente el trabajo',
}

export default function CreateTicketPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [clients, setClients] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [selectedClient, setSelectedClient] = useState<User | null>(null)
  const [loadError, setLoadError] = useState('')
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null)
  
  // Estados para archivos
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTicketData>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      priority: TicketPriority.MEDIUM,
    },
  })

  const selectedPriority = watch('priority')
  const selectedCategoryId = watch('categoryId')
  const ticketTitle = watch('title')
  const ticketDescription = watch('description')
  const clientId = watch('clientId')

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'ADMIN') {
      router.push('/unauthorized')
      return
    }

    // Cargar clientes
    loadClients()
  }, [session, status, router])

  const loadClients = async () => {
    try {
      setLoadError('')
      
      const clientsResponse = await fetch('/api/users?role=CLIENT&isActive=true')
      
      if (clientsResponse.ok) {
        const result = await clientsResponse.json()
        if (result.success && result.data) {
          setClients(result.data)
        }
      } else {
        setLoadError('Error al cargar los clientes')
      }
    } catch (error) {
      console.error('Error loading clients:', error)
      setLoadError('Error de conexión al cargar los datos')
    } finally {
      setIsLoading(false)
    }
  }

  // Manejar selección de archivos
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    // Verificar límite de archivos (máximo 5)
    if (selectedFiles.length + files.length > 5) {
      toast({
        title: 'Límite excedido',
        description: 'Máximo 5 archivos permitidos',
        variant: 'destructive'
      })
      return
    }

    // Verificar tamaño de archivos (máximo 10MB cada uno)
    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      toast({
        title: 'Archivo muy grande',
        description: 'Los archivos no deben superar 10MB',
        variant: 'destructive'
      })
      return
    }

    setSelectedFiles(prev => [...prev, ...files])
    
    // Limpiar input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async (ticketId: string) => {
    if (selectedFiles.length === 0) return

    for (const file of selectedFiles) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        await fetch(`/api/tickets/${ticketId}/attachments`, {
          method: 'POST',
          body: formData
        })
      } catch (error) {
        console.error('Error uploading file:', error)
      }
    }
  }

  const onSubmit = async (data: CreateTicketData) => {
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const result = await response.json()
        const ticketId = result.data.id
        setCreatedTicketId(ticketId)
        
        // Subir archivos si hay
        await uploadFiles(ticketId)
        
        setSubmitSuccess(true)

        // Disparar evento para actualizar notificaciones inmediatamente
        window.dispatchEvent(new CustomEvent('ticket-created'))

        toast({
          title: 'Éxito',
          description: 'Ticket creado exitosamente'
        })

        // Redirigir después de 2 segundos
        setTimeout(() => {
          router.push(`/admin/tickets/${ticketId}`)
        }, 2000)
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.message || 'Error al crear el ticket',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error submitting ticket:', error)
      toast({
        title: 'Error',
        description: 'Error de conexión al crear el ticket',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    setSelectedClient(client || null)
    setValue('clientId', clientId)
  }

  if (status === 'loading' || isLoading) {
    return (
      <RoleDashboardLayout title='Crear Ticket' subtitle='Nueva solicitud de soporte'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (submitSuccess) {
    return (
      <RoleDashboardLayout title='Ticket Creado' subtitle='Solicitud enviada exitosamente'>
        <Card className='max-w-2xl mx-auto'>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <CheckCircle className='h-16 w-16 text-green-600 mx-auto mb-4' />
              <h2 className='text-2xl font-semibold text-foreground mb-2'>
                ¡Ticket creado exitosamente!
              </h2>
              <p className='text-muted-foreground mb-6'>
                El ticket ha sido creado y será atendido por el equipo de soporte.
                El cliente recibirá notificaciones sobre el progreso.
              </p>
              <div className='flex items-center justify-center space-x-4'>
                <Button asChild>
                  <Link href='/admin/tickets'>Ver Todos los Tickets</Link>
                </Button>
                <Button variant='outline' asChild>
                  <Link href='/admin'>Ir al Dashboard</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </RoleDashboardLayout>
    )
  }

  const headerActions = (
    <Button variant='outline' asChild>
      <Link href='/admin/tickets'>
        <ArrowLeft className='h-4 w-4 mr-2' />
        Volver a Tickets
      </Link>
    </Button>
  )

  return (
    <RoleDashboardLayout
      title='Crear Nuevo Ticket'
      subtitle='Crear ticket en nombre de un cliente'
      headerActions={headerActions}
    >
      <div className='max-w-6xl mx-auto'>
        {loadError && (
          <Alert variant='destructive' className='mb-6'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}
        
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Formulario Principal */}
          <div className='lg:col-span-2'>
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">
                  <FileText className='h-4 w-4 mr-2' />
                  Detalles del Ticket
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Zap className='h-4 w-4 mr-2' />
                  Vista Previa
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center'>
                      <Ticket className='h-5 w-5 mr-2 text-blue-600' />
                      Información del Ticket
                    </CardTitle>
                    <CardDescription>
                      Completa todos los campos para crear un ticket completo y detallado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
                      {/* Cliente */}
                      <div className='space-y-2'>
                        <Label htmlFor='clientId' className='flex items-center'>
                          <User className='h-4 w-4 mr-2' />
                          Cliente *
                        </Label>
                        <UserCombobox
                          role="CLIENT"
                          value={watch('clientId')}
                          onValueChange={(clientId) => {
                            setValue('clientId', clientId)
                            handleClientSelect(clientId)
                          }}
                          placeholder="Buscar cliente por nombre o email..."
                          emptyText="No se encontraron clientes"
                          showEmail={true}
                          showDepartment={true}
                          className={errors.clientId ? 'border-red-500' : ''}
                        />
                        {errors.clientId && <p className='text-sm text-red-600'>{errors.clientId.message}</p>}
                        {selectedClient && (
                          <p className='text-xs text-muted-foreground'>
                            💡 Tip: El cliente recibirá notificaciones automáticas sobre el progreso del ticket
                          </p>
                        )}
                      </div>

                      <Separator />

                      {/* Título */}
                      <div className='space-y-2'>
                        <Label htmlFor='title'>Título del Ticket *</Label>
                        <Input
                          id='title'
                          placeholder='Describe brevemente el problema o solicitud'
                          {...register('title')}
                          className={errors.title ? 'border-red-500' : ''}
                        />
                        {errors.title && <p className='text-sm text-red-600'>{errors.title.message}</p>}
                        <p className='text-xs text-muted-foreground'>
                          Usa un título claro y descriptivo que resuma el problema
                        </p>
                      </div>

                      {/* Descripción */}
                      <div className='space-y-2'>
                        <Label htmlFor='description'>Descripción Detallada *</Label>
                        <Textarea
                          id='description'
                          placeholder='Proporciona todos los detalles relevantes sobre el problema o solicitud. Incluye pasos para reproducir el problema, mensajes de error, etc.'
                          rows={6}
                          {...register('description')}
                          className={errors.description ? 'border-red-500' : ''}
                        />
                        {errors.description && (
                          <p className='text-sm text-red-600'>{errors.description.message}</p>
                        )}
                      </div>

                      {/* Prioridad */}
                      <div className='space-y-2'>
                        <Label htmlFor='priority' className='flex items-center'>
                          <AlertCircle className='h-4 w-4 mr-2' />
                          Prioridad *
                        </Label>
                        <Select
                          value={selectedPriority}
                          onValueChange={value => setValue('priority', value as TicketPriority)}
                        >
                          <SelectTrigger className={errors.priority ? 'border-red-500' : ''}>
                            <SelectValue placeholder='Selecciona la prioridad' />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(priorityLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                <div className='flex items-center space-x-2'>
                                  <div
                                    className={`w-3 h-3 rounded-full ${
                                      value === 'LOW'
                                        ? 'bg-green-500'
                                        : value === 'MEDIUM'
                                          ? 'bg-yellow-500'
                                          : value === 'HIGH'
                                            ? 'bg-orange-500'
                                            : 'bg-red-500'
                                    }`}
                                  />
                                  <span>{label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.priority && (
                          <p className='text-sm text-red-600'>{errors.priority.message}</p>
                        )}
                        {selectedPriority && (
                          <div className={`p-3 rounded-lg text-xs ${priorityColors[selectedPriority as keyof typeof priorityColors]}`}>
                            <strong>{priorityLabels[selectedPriority as keyof typeof priorityLabels]}:</strong> {priorityDescriptions[selectedPriority as keyof typeof priorityDescriptions]}
                          </div>
                        )}
                      </div>

                      <Separator className='my-6' />

                      {/* Selector de Categorías Mejorado - ANCHO COMPLETO CON MÁS ESPACIO */}
                      <div className='space-y-2'>
                        <Label className='flex items-center text-base font-semibold'>
                          <Tag className='h-5 w-5 mr-2' />
                          Categoría del Ticket *
                        </Label>
                        <p className='text-sm text-muted-foreground mb-3'>
                          Selecciona la categoría más específica que describa el problema. Puedes usar la búsqueda (Ctrl+K) o navegar por el árbol.
                        </p>
                        <div className='border rounded-lg p-4 bg-muted/30'>
                          <CategorySelectorWrapper
                            value={selectedCategoryId}
                            onChange={(categoryId) => setValue('categoryId', categoryId)}
                            ticketTitle={ticketTitle || ''}
                            ticketDescription={ticketDescription || ''}
                            clientId={clientId || ''}
                            error={errors.categoryId?.message}
                          />
                        </div>
                      </div>

                      <Separator className='my-6' />

                      {/* Archivos Adjuntos */}
                      <div className='space-y-2'>
                        <Label>Archivos Adjuntos (Opcional)</Label>
                        <div className='border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-gray-400 transition-colors'>
                          <input
                            ref={fileInputRef}
                            type='file'
                            multiple
                            onChange={handleFileSelect}
                            className='hidden'
                            accept='image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt'
                          />
                          <Upload className='h-8 w-8 text-muted-foreground mx-auto mb-2' />
                          <p className='text-sm text-muted-foreground mb-2'>
                            Arrastra archivos aquí o haz clic para seleccionar
                          </p>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Paperclip className='h-4 w-4 mr-2' />
                            Seleccionar Archivos
                          </Button>
                          <p className='text-xs text-muted-foreground mt-2'>
                            Máximo 5 archivos, 10MB cada uno. Formatos: imágenes, PDF, documentos
                          </p>
                        </div>

                        {/* Lista de archivos seleccionados */}
                        {selectedFiles.length > 0 && (
                          <div className='space-y-2 mt-3'>
                            <p className='text-sm font-medium'>Archivos seleccionados ({selectedFiles.length}/5):</p>
                            {selectedFiles.map((file, index) => (
                              <div
                                key={index}
                                className='flex items-center justify-between p-2 bg-muted rounded-lg'
                              >
                                <div className='flex items-center space-x-2'>
                                  <File className='h-4 w-4 text-muted-foreground' />
                                  <div>
                                    <p className='text-sm font-medium'>{file.name}</p>
                                    <p className='text-xs text-muted-foreground'>
                                      {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type='button'
                                  variant='ghost'
                                  size='sm'
                                  onClick={() => removeFile(index)}
                                >
                                  <X className='h-4 w-4' />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Botones */}
                      <div className='flex items-center justify-end space-x-4 pt-6 border-t'>
                        <Button type='button' variant='outline' asChild>
                          <Link href='/admin/tickets'>Cancelar</Link>
                        </Button>
                        <Button type='submit' disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                              Creando Ticket...
                            </>
                          ) : (
                            <>
                              <Ticket className='h-4 w-4 mr-2' />
                              Crear Ticket
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="preview" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Vista Previa del Ticket</CardTitle>
                    <CardDescription>
                      Revisa cómo se verá el ticket antes de crearlo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-4'>
                      <div>
                        <Label className='text-sm font-medium text-muted-foreground'>Título</Label>
                        <p className='text-lg font-semibold'>{watch('title') || 'Sin título'}</p>
                      </div>
                      
                      <div>
                        <Label className='text-sm font-medium text-muted-foreground'>Descripción</Label>
                        <div className='mt-1 p-3 bg-muted rounded-lg'>
                          <p className='whitespace-pre-wrap text-sm'>
                            {watch('description') || 'Sin descripción'}
                          </p>
                        </div>
                      </div>
                      
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <Label className='text-sm font-medium text-muted-foreground'>Prioridad</Label>
                          {selectedPriority && (
                            <Badge className={priorityColors[selectedPriority as keyof typeof priorityColors]}>
                              {priorityLabels[selectedPriority as keyof typeof priorityLabels]}
                            </Badge>
                          )}
                        </div>
                        
                        <div>
                          <Label className='text-sm font-medium text-muted-foreground'>Categoría</Label>
                          {selectedCategoryId ? (
                            <Badge variant="outline">
                              Categoría seleccionada
                            </Badge>
                          ) : (
                            <p className='text-sm text-muted-foreground'>Sin categoría</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className='space-y-6'>
            {/* Cliente Seleccionado */}
            {selectedClient && (
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center text-sm'>
                    <User className='h-4 w-4 mr-2' />
                    Cliente Seleccionado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-3'>
                    <div>
                      <p className='font-medium'>{selectedClient.name}</p>
                      <p className='text-sm text-muted-foreground'>{selectedClient.email}</p>
                    </div>
                    {selectedClient.department && (
                      <Badge 
                        variant="outline"
                        style={{ 
                          borderColor: selectedClient.department.color,
                          color: selectedClient.department.color
                        }}
                      >
                        {selectedClient.department.name}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Consejos */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center text-sm'>
                  <Info className='h-4 w-4 mr-2' />
                  Consejos para un Buen Ticket
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3 text-sm'>
                  <div className='flex items-start space-x-2'>
                    <CheckCircle className='h-4 w-4 text-green-600 mt-0.5 flex-shrink-0' />
                    <p>Usa un título claro y específico</p>
                  </div>
                  <div className='flex items-start space-x-2'>
                    <CheckCircle className='h-4 w-4 text-green-600 mt-0.5 flex-shrink-0' />
                    <p>Incluye pasos para reproducir el problema</p>
                  </div>
                  <div className='flex items-start space-x-2'>
                    <CheckCircle className='h-4 w-4 text-green-600 mt-0.5 flex-shrink-0' />
                    <p>Menciona el navegador y sistema operativo</p>
                  </div>
                  <div className='flex items-start space-x-2'>
                    <CheckCircle className='h-4 w-4 text-green-600 mt-0.5 flex-shrink-0' />
                    <p>Adjunta capturas de pantalla si es relevante</p>
                  </div>
                  <div className='flex items-start space-x-2'>
                    <CheckCircle className='h-4 w-4 text-green-600 mt-0.5 flex-shrink-0' />
                    <p>Selecciona la prioridad correcta</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Información Adicional */}
            <Alert>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                <strong>Nota:</strong> Este ticket se creará en nombre del cliente seleccionado.
                El cliente recibirá notificaciones automáticas sobre el progreso del ticket.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
