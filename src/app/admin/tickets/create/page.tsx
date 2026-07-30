'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ModuleLayout } from '@/components/common/layout/module-layout'
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
  Paperclip,
  MapPin,
  Camera,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { UserCombobox } from '@/components/ui/user-combobox'
import { CategorySelectorWrapper } from '@/features/category-selection'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'
import { useUsers } from '@/contexts/users-context'
import { TicketSupportAreaField } from '@/components/tickets/ticket-support-area-field'
import { ticketRequestFamiliesUrl } from '@/lib/utils/ticket-family'
import { pickDefaultTicketFamilyId } from '@/hooks/use-ticket-request-families'

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
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [selectedClient, setSelectedClient] = useState<User | null>(null)
  const [loadError, setLoadError] = useState('')
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null)

  // ✅ Usuarios desde contexto global — sin petición extra
  const { users: allUsers } = useUsers()

  // Familias disponibles para el cliente seleccionado
  const [clientFamilies, setClientFamilies] = useState<
    Array<{ id: string; name: string; code: string; color?: string | null; isOwnFamily?: boolean }>
  >([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')
  const [loadingFamilies, setLoadingFamilies] = useState(false)
  const isSuperAdmin = !!(session?.user as any)?.isSuperAdmin

  // Estados para archivos
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

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
  }, [session, status, router])

  // Ticket propio por defecto al cargar sesión (un solo combobox, sin botones extra)
  useEffect(() => {
    if (!session?.user?.id) return
    const current = watch('clientId')
    if (!current) {
      void handleClientSelect(session.user.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  // Manejar selección de archivos
  const processFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files)
    if (newFiles.length === 0) return

    // Verificar límite de archivos (máximo 5)
    if (selectedFiles.length + newFiles.length > 5) {
      toast({
        title: 'Límite excedido',
        description: 'Máximo 5 archivos permitidos',
        variant: 'destructive',
      })
      return
    }

    // Verificar tamaño de archivos (máximo 10MB cada uno)
    const oversizedFiles = newFiles.filter(file => file.size > 10 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      toast({
        title: 'Archivo muy grande',
        description: 'Los archivos no deben superar 10MB',
        variant: 'destructive',
      })
      return
    }

    setSelectedFiles(prev => [...prev, ...newFiles])
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    processFiles(files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
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
          body: formData,
        })
      } catch (error) {
        console.error('Error uploading file:', error)
      }
    }
  }

  const onSubmit = async (data: CreateTicketData) => {
    if (!selectedFamilyId) {
      toast({
        title: 'Área requerida',
        description: 'Selecciona el área de soporte antes de crear el ticket.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          familyId: selectedFamilyId,
        }),
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
          description: 'Ticket creado exitosamente',
        })

        // Redirigir después de 2 segundos
        setTimeout(() => {
          router.push(`/admin/tickets/${ticketId}`)
        }, 2000)
      } else {
        const error = await response.json().catch(() => ({}))
        toast({
          title: 'Error',
          description: error.error || error.message || 'Error al crear el ticket',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error submitting ticket:', error)
      toast({
        title: 'Error',
        description: 'Error de conexión al crear el ticket',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClientSelect = async (nextClientId: string) => {
    if (nextClientId !== session?.user?.id) {
      const fromList = allUsers.find(u => u.id === nextClientId)
      if (fromList) {
        setSelectedClient({
          id: fromList.id,
          name: fromList.name,
          email: fromList.email,
          role: fromList.role,
          department: fromList.department
            ? {
                id: fromList.departmentId || '',
                name: typeof fromList.department === 'string' ? fromList.department : '',
                color: '#6B7280',
              }
            : undefined,
        })
      } else {
        // Fallback: cargar datos del usuario seleccionado en el combobox
        try {
          const res = await fetch(`/api/users/${nextClientId}`)
          if (res.ok) {
            const u = await res.json()
            const data = u.data ?? u
            setSelectedClient({
              id: data.id,
              name: data.name || '',
              email: data.email || '',
              role: data.role || 'CLIENT',
              department: data.department || data.departments || undefined,
            })
          } else {
            setSelectedClient({
              id: nextClientId,
              name: 'Usuario seleccionado',
              email: '',
              role: 'CLIENT',
            })
          }
        } catch {
          setSelectedClient({
            id: nextClientId,
            name: 'Usuario seleccionado',
            email: '',
            role: 'CLIENT',
          })
        }
      }
    } else if (session?.user) {
      setSelectedClient({
        id: session.user.id,
        name: session.user.name || 'Administrador',
        email: session.user.email || '',
        role: session.user.role,
      })
    }
    setValue('clientId', nextClientId)
    // Limpiar familia y categoría al cambiar solicitante
    setSelectedFamilyId('')
    setValue('categoryId', '')
    setClientFamilies([])

    // Cargar familias del solicitante / scope del admin
    if (nextClientId) {
      setLoadingFamilies(true)
      try {
        const isOwnTicket = nextClientId === session?.user?.id
        const url = ticketRequestFamiliesUrl({
          forClientId: isOwnTicket ? null : nextClientId,
        })
        const res = await fetch(url)
        if (res.ok) {
          const json = await res.json()
          const families: Array<{
            id: string
            name: string
            code: string
            color?: string | null
            isOwnFamily?: boolean
          }> = json.data ?? []
          setClientFamilies(families)
          const defaultId = pickDefaultTicketFamilyId(families)
          if (defaultId) setSelectedFamilyId(defaultId)
        }
      } catch {
        /* silencioso */
      } finally {
        setLoadingFamilies(false)
      }
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <ModuleLayout title='Crear Ticket' subtitle='Nueva solicitud de soporte' loading={true}>
        <div />
      </ModuleLayout>
    )
  }

  if (submitSuccess) {
    return (
      <ModuleLayout title='Ticket Creado' subtitle='Solicitud enviada exitosamente'>
        <Card className='max-w-2xl mx-auto'>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <CheckCircle className='h-16 w-16 text-emerald-600 dark:text-emerald-400 mx-auto mb-4' />
              <h2 className='text-2xl font-semibold text-foreground mb-2'>
                ¡Ticket creado exitosamente!
              </h2>
              <p className='text-muted-foreground mb-6'>
                El ticket ha sido creado y será atendido por el equipo de soporte. El cliente
                recibirá notificaciones sobre el progreso.
              </p>
              <div className='flex flex-col sm:flex-row items-center justify-center gap-3'>
                <Button asChild className='w-full sm:w-auto'>
                  <Link href='/admin/tickets'>Ver Todos los Tickets</Link>
                </Button>
                <Button variant='outline' asChild className='w-full sm:w-auto'>
                  <Link href='/admin'>Ir al Dashboard</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </ModuleLayout>
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
    <ModuleLayout
      title='Crear Nuevo Ticket'
      subtitle='Crear ticket propio o en nombre de un usuario'
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
            <Tabs defaultValue='details' className='w-full'>
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value='details'>
                  <FileText className='h-4 w-4 mr-2' />
                  Detalles del Ticket
                </TabsTrigger>
                <TabsTrigger value='preview'>
                  <Zap className='h-4 w-4 mr-2' />
                  Vista Previa
                </TabsTrigger>
              </TabsList>

              <TabsContent value='details' className='space-y-6 mt-6'>
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center'>
                      <Ticket className='h-5 w-5 mr-2 text-primary' />
                      Información del Ticket
                    </CardTitle>
                    <CardDescription>
                      Completa todos los campos para crear un ticket completo y detallado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
                      {/* Solicitante: combobox único. Default = tú; otro usuario = en su nombre */}
                      <div className='space-y-2'>
                        <Label htmlFor='clientId' className='flex items-center'>
                          <User className='h-4 w-4 mr-2' />
                          Solicitante *
                        </Label>
                        <UserCombobox
                          value={clientId}
                          onValueChange={id => {
                            // Limpiar vuelve a ticket propio (evita formulario vacío)
                            if (!id && session?.user?.id) {
                              void handleClientSelect(session.user.id)
                              return
                            }
                            if (id) void handleClientSelect(id)
                          }}
                          placeholder='Buscar usuario por nombre o email...'
                          emptyText='No se encontraron usuarios'
                          showEmail={true}
                          showDepartment={true}
                          allowClear={clientId !== session?.user?.id}
                          preloadedUser={
                            session?.user
                              ? {
                                  id: session.user.id,
                                  name: session.user.name || 'Administrador',
                                  email: session.user.email || '',
                                  role: session.user.role as 'ADMIN' | 'CLIENT' | 'TECHNICIAN',
                                }
                              : null
                          }
                          className={errors.clientId ? 'border-red-500' : ''}
                        />
                        {errors.clientId && (
                          <p className='text-sm text-destructive'>{errors.clientId.message}</p>
                        )}
                        <p className='text-xs text-muted-foreground'>
                          {clientId === session?.user?.id
                            ? 'Ticket propio: la solicitud queda a tu nombre. Elige otro usuario en la lista para crearla en su nombre.'
                            : selectedClient
                              ? `En nombre de ${selectedClient.name}: el ticket y las notificaciones quedan asociados a ese usuario.`
                              : 'Selecciona el solicitante del ticket.'}
                        </p>
                      </div>

                      {/* Área de soporte — visible solo cuando hay cliente seleccionado */}
                      {clientId && (
                        <TicketSupportAreaField
                          families={clientFamilies}
                          loading={loadingFamilies}
                          value={selectedFamilyId}
                          onValueChange={v => {
                            setSelectedFamilyId(v)
                            setValue('categoryId', '')
                          }}
                        />
                      )}

                      <Separator />

                      {/* Título */}
                      <div className='space-y-2'>
                        <Label htmlFor='title'>Título del Ticket *</Label>
                        <Input
                          id='title'
                          // placeholder='Describe brevemente el problema o solicitud'
                          {...register('title')}
                          className={errors.title ? 'border-red-500' : ''}
                        />
                        {errors.title && (
                          <p className='text-sm text-destructive'>{errors.title.message}</p>
                        )}
                        {/* <p className='text-xs text-muted-foreground'>
                          Usa un título claro y descriptivo que resuma el problema
                        </p> */}
                      </div>

                      {/* Descripción */}
                      <div className='space-y-2'>
                        <Label htmlFor='description'>Descripción Detallada *</Label>
                        <Textarea
                          id='description'
                          // placeholder='Proporciona todos los detalles relevantes sobre el problema o solicitud. Incluye pasos para reproducir el problema, mensajes de error, etc.'
                          rows={6}
                          {...register('description')}
                          className={errors.description ? 'border-red-500' : ''}
                        />
                        {errors.description && (
                          <p className='text-sm text-destructive'>{errors.description.message}</p>
                        )}
                      </div>

                      {/* Ubicación */}
                      <div className='space-y-2'>
                        <Label htmlFor='location' className='flex items-center gap-1.5'>
                          <MapPin className='h-4 w-4' />
                          Ubicación / Área
                          <span className='text-muted-foreground font-normal text-xs'>
                            (opcional)
                          </span>
                        </Label>
                        <Input
                          id='location'
                          // placeholder='Ej: Oficina 201, Piso 3, Sala de Reuniones A...'
                          {...register('location')}
                        />
                        {/* <p className='text-xs text-muted-foreground'>
                          Indica dónde debe acercarse el técnico para atender el problema.
                        </p> */}
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
                          <p className='text-sm text-destructive'>{errors.priority.message}</p>
                        )}
                        {selectedPriority && (
                          <div
                            className={`p-3 rounded-lg text-xs ${priorityColors[selectedPriority as keyof typeof priorityColors]}`}
                          >
                            <strong>
                              {priorityLabels[selectedPriority as keyof typeof priorityLabels]}:
                            </strong>{' '}
                            {
                              priorityDescriptions[
                                selectedPriority as keyof typeof priorityDescriptions
                              ]
                            }
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
                          Selecciona la categoría más específica que describa el problema. Puedes
                          usar la búsqueda (Ctrl+K) o navegar por el árbol.
                        </p>
                        <div className='border rounded-lg p-4 bg-muted/30'>
                          <CategorySelectorWrapper
                            value={selectedCategoryId}
                            onChange={categoryId => setValue('categoryId', categoryId)}
                            ticketTitle={ticketTitle || ''}
                            ticketDescription={ticketDescription || ''}
                            clientId={clientId || ''}
                            familyId={selectedFamilyId || undefined}
                            requireFamily
                            error={errors.categoryId?.message}
                          />
                        </div>
                      </div>

                      <Separator className='my-6' />

                      {/* Archivos Adjuntos */}
                      <div className='space-y-2'>
                        <Label>Archivos Adjuntos (Opcional)</Label>
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`border-2 rounded-lg p-4 transition-all ${
                            isDragging
                              ? 'border-primary bg-primary/5 dark:bg-primary/10'
                              : 'border-dashed border-border'
                          }`}
                        >
                          <FileInputWithCamera
                            accept='image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt'
                            multiple
                            onChange={handleFileSelect}
                          >
                            {({ openFile, openCamera, showCamera }) => (
                              <div className='flex flex-col items-center gap-3'>
                                <Upload className='h-8 w-8 text-muted-foreground' />
                                <p className='text-sm text-muted-foreground text-center'>
                                  {isDragging
                                    ? 'Suelta los archivos aquí'
                                    : 'Arrastra archivos aquí o usa los botones'}
                                </p>
                                <div className='flex items-center gap-2 flex-wrap justify-center'>
                                  {showCamera && (
                                    <Button
                                      type='button'
                                      variant='outline'
                                      size='sm'
                                      onClick={() => openCamera()}
                                    >
                                      <Camera className='h-4 w-4 mr-2' />
                                      Tomar foto
                                    </Button>
                                  )}
                                  <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={openFile}
                                  >
                                    <Paperclip className='h-4 w-4 mr-2' />
                                    {showCamera ? 'Galería / Archivo' : 'Seleccionar Archivos'}
                                  </Button>
                                </div>
                                <p className='text-xs text-muted-foreground'>
                                  Máximo 5 archivos, 10MB cada uno
                                </p>
                              </div>
                            )}
                          </FileInputWithCamera>
                        </div>

                        {/* Lista de archivos seleccionados */}
                        {selectedFiles.length > 0 && (
                          <div className='space-y-2 mt-3'>
                            <p className='text-sm font-medium'>
                              Archivos seleccionados ({selectedFiles.length}/5):
                            </p>
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

              <TabsContent value='preview' className='space-y-6 mt-6'>
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
                        <Label className='text-sm font-medium text-muted-foreground'>
                          Descripción
                        </Label>
                        <div className='mt-1 p-3 bg-muted rounded-lg'>
                          <p className='whitespace-pre-wrap text-sm'>
                            {watch('description') || 'Sin descripción'}
                          </p>
                        </div>
                      </div>

                      {watch('location') && (
                        <div>
                          <Label className='text-sm font-medium text-muted-foreground'>
                            Ubicación
                          </Label>
                          <div className='mt-1 flex items-center gap-2 text-sm'>
                            <MapPin className='h-3.5 w-3.5 text-amber-600' />
                            <span>{watch('location')}</span>
                          </div>
                        </div>
                      )}

                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <Label className='text-sm font-medium text-muted-foreground'>
                            Prioridad
                          </Label>
                          {selectedPriority && (
                            <Badge
                              className={
                                priorityColors[selectedPriority as keyof typeof priorityColors]
                              }
                            >
                              {priorityLabels[selectedPriority as keyof typeof priorityLabels]}
                            </Badge>
                          )}
                        </div>

                        <div>
                          <Label className='text-sm font-medium text-muted-foreground'>
                            Categoría
                          </Label>
                          {selectedCategoryId ? (
                            <Badge variant='outline'>Categoría seleccionada</Badge>
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
              <Card
                className={clientId === session?.user?.id ? 'border-primary/30 bg-primary/5' : ''}
              >
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center text-sm'>
                    <User className='h-4 w-4 mr-2' />
                    {clientId === session?.user?.id ? 'Tu Ticket' : 'Cliente Seleccionado'}
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
                        variant='outline'
                        style={{
                          borderColor: selectedClient.department.color,
                          color: selectedClient.department.color,
                        }}
                      >
                        {selectedClient.department.name}
                      </Badge>
                    )}
                    {clientId === session?.user?.id ? (
                      <p className='text-xs text-primary font-medium'>
                        🎟️ Gracias por utilizar el servicio de tickets. Tu solicitud quedará
                        registrada a tu nombre.
                      </p>
                    ) : (
                      <p className='text-xs text-muted-foreground'>
                        📋 El ticket se creará a nombre de este cliente.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Consejos compactos */}
            <div className='border rounded-lg p-3 bg-muted/20'>
              <p className='text-xs font-semibold text-muted-foreground mb-1.5'>
                💡 Consejos rápidos:
              </p>
              <ul className='text-xs text-muted-foreground space-y-0.5'>
                <li>• Título claro y descriptivo</li>
                <li>• Describe con detalles el problema</li>
                <li>• Adjunta fotos/capturas si aplica</li>
                <li>• Prioridad según impacto real</li>
              </ul>
            </div>

            {/* Información Adicional */}
            <Alert
              className={clientId === session?.user?.id ? 'border-primary/40 bg-primary/5' : ''}
            >
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                <strong>Nota:</strong>{' '}
                {clientId === session?.user?.id
                  ? 'Este ticket se registrará como solicitud propia. Quedará asociado a tu cuenta.'
                  : selectedClient
                    ? `Este ticket se creará a nombre de ${selectedClient.name}. El cliente recibirá notificaciones automáticas sobre el progreso.`
                    : 'Selecciona el solicitante del ticket para continuar.'}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </ModuleLayout>
  )
}
