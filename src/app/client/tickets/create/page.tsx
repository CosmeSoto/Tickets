'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Separator } from '@/components/ui/separator'
import { createTicketSchema, CreateTicketData } from '@/lib/schemas/ticket-schemas'
import { TicketPriority } from '@prisma/client'
import { 
  Ticket, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  ArrowLeft, 
  Tag,
  FileText,
  Zap,
  Upload,
  File,
  X,
  Paperclip
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { CategorySelectorWrapper } from '@/features/category-selection'
import { FilePreviewList } from '@/components/tickets/file-preview-list'

const priorityLabels = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const priorityColors = {
  LOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200',
  URGENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200',
}

const priorityDescriptions = {
  LOW: 'Para consultas generales o mejoras no urgentes',
  MEDIUM: 'Para problemas que afectan el trabajo pero tienen soluciones alternativas',
  HIGH: 'Para problemas que impactan significativamente el trabajo',
  URGENT: 'Para problemas críticos que bloquean completamente el trabajo',
}

export default function CreateClientTicketPage() {
  return (
    <Suspense fallback={
      <RoleDashboardLayout title='Crear Ticket' subtitle='Nueva solicitud de soporte'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
        </div>
      </RoleDashboardLayout>
    }>
      <CreateClientTicketContent />
    </Suspense>
  )
}

function CreateClientTicketContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null)
  const [equipmentId, setEquipmentId] = useState<string | null>(null)
  
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
      clientId: session?.user?.id,
    },
  })

  const selectedPriority = watch('priority')
  const selectedCategoryId = watch('categoryId')
  const ticketTitle = watch('title')
  const ticketDescription = watch('description')

  // Pre-llenar formulario desde query params (para reportar problemas de equipos)
  useEffect(() => {
    const title = searchParams.get('title')
    const description = searchParams.get('description')
    const equipId = searchParams.get('equipmentId')

    if (title) {
      setValue('title', title)
    }
    if (description) {
      setValue('description', description)
    }
    if (equipId) {
      setEquipmentId(equipId)
    }
  }, [searchParams, setValue])

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'CLIENT') {
      router.push('/unauthorized')
      return
    }

    // Auto-asignar el clientId
    setValue('clientId', session.user.id)
  }, [session, status, router, setValue])

  // Manejar selección de archivos
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    if (selectedFiles.length + files.length > 5) {
      toast({
        title: 'Límite excedido',
        description: 'Máximo 5 archivos permitidos',
        variant: 'destructive'
      })
      return
    }

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
        
        await uploadFiles(ticketId)
        
        // Si viene de un reporte de equipo, vincular el ticket con el equipo
        if (equipmentId) {
          try {
            await fetch(`/api/inventory/equipment/${equipmentId}/link-ticket`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ ticketId }),
            })
          } catch (error) {
            console.error('Error vinculando ticket con equipo:', error)
            // No fallar si el vínculo falla, el ticket ya fue creado
          }
        }
        
        setSubmitSuccess(true)

        // Disparar evento para actualizar notificaciones inmediatamente
        window.dispatchEvent(new CustomEvent('ticket-created'))

        toast({
          title: 'Éxito',
          description: 'Tu ticket ha sido creado exitosamente'
        })

        setTimeout(() => {
          router.push(`/client/tickets/${ticketId}`)
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

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title='Crear Ticket' subtitle='Nueva solicitud de soporte'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
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
                Tu solicitud ha sido recibida y será atendida por nuestro equipo de soporte.
                Recibirás notificaciones sobre el progreso.
              </p>
              <div className='flex items-center justify-center space-x-4'>
                <Button asChild>
                  <Link href='/client/tickets'>Ver Mis Tickets</Link>
                </Button>
                <Button variant='outline' asChild>
                  <Link href='/client'>Ir al Dashboard</Link>
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
      <Link href='/client/tickets'>
        <ArrowLeft className='h-4 w-4 mr-2' />
        Volver a Mis Tickets
      </Link>
    </Button>
  )

  return (
    <RoleDashboardLayout
      title='Crear Nuevo Ticket'
      subtitle='Describe tu problema o solicitud'
      headerActions={headerActions}
    >
      <div className='max-w-4xl mx-auto'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center'>
              <Ticket className='h-5 w-5 mr-2 text-primary' />
              Nueva Solicitud de Soporte
            </CardTitle>
            <CardDescription>
              Completa el formulario con los detalles de tu problema o solicitud
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
              {/* Título */}
              <div className='space-y-1.5'>
                <Label htmlFor='title'>Título *</Label>
                <Input
                  id='title'
                  placeholder='Describe brevemente tu problema'
                  {...register('title')}
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && <p className='text-xs text-red-600'>{errors.title.message}</p>}
              </div>

              {/* Descripción */}
              <div className='space-y-1.5'>
                <Label htmlFor='description'>Descripción Detallada *</Label>
                <Textarea
                  id='description'
                  placeholder='Proporciona todos los detalles relevantes sobre tu problema. Incluye pasos para reproducirlo, mensajes de error, etc.'
                  rows={4}
                  {...register('description')}
                  className={errors.description ? 'border-red-500' : ''}
                />
                {errors.description && (
                  <p className='text-xs text-red-600'>{errors.description.message}</p>
                )}
              </div>

              {/* Prioridad */}
              <div className='space-y-1.5'>
                <Label htmlFor='priority' className='flex items-center gap-1.5'>
                  <Zap className='h-3.5 w-3.5' />
                  Prioridad *
                </Label>
                <Select
                  value={selectedPriority}
                  onValueChange={value => setValue('priority', value as TicketPriority)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div className='flex items-center space-x-2'>
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
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
                {selectedPriority && (
                  <p className={`px-2 py-1.5 rounded text-xs ${priorityColors[selectedPriority as keyof typeof priorityColors]}`}>
                    <strong>{priorityLabels[selectedPriority as keyof typeof priorityLabels]}:</strong>{' '}
                    {priorityDescriptions[selectedPriority as keyof typeof priorityDescriptions]}
                  </p>
                )}
              </div>

              <Separator />

              {/* Selector de Categorías */}
              <div className='space-y-1.5'>
                <Label className='flex items-center gap-1.5 text-sm font-semibold'>
                  <Tag className='h-4 w-4' />
                  Categoría *
                </Label>
                <p className='text-xs text-muted-foreground'>
                  Selecciona la categoría que mejor describa tu problema. Usa la búsqueda (Ctrl+K) para encontrarla rápidamente.
                </p>
                <div className='border rounded-lg p-3 bg-muted/30'>
                  <CategorySelectorWrapper
                    value={selectedCategoryId}
                    onChange={(categoryId) => setValue('categoryId', categoryId)}
                    ticketTitle={ticketTitle || ''}
                    ticketDescription={ticketDescription || ''}
                    clientId={session?.user?.id || ''}
                    error={errors.categoryId?.message}
                  />
                </div>
              </div>

              <Separator />

              {/* Archivos Adjuntos */}
              <div className='space-y-1.5'>
                <Label>Archivos Adjuntos (Opcional)</Label>
                <div className='border-2 border-dashed border-border rounded-lg px-4 py-3'>
                  <input
                    ref={fileInputRef}
                    type='file'
                    multiple
                    onChange={handleFileSelect}
                    className='hidden'
                    accept='image/*,.pdf,.doc,.docx,.txt'
                  />
                  <div className='flex items-center justify-between gap-4'>
                    <div className='flex items-center gap-3'>
                      <Upload className='h-5 w-5 text-muted-foreground flex-shrink-0' />
                      <p className='text-xs text-muted-foreground'>Máximo 5 archivos, 10MB cada uno</p>
                    </div>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className='h-3.5 w-3.5 mr-1.5' />
                      Seleccionar
                    </Button>
                  </div>
                </div>

                {selectedFiles.length > 0 && (
                  <FilePreviewList files={selectedFiles} onRemove={removeFile} />
                )}
              </div>

              {/* Botones */}
              <div className='flex items-center justify-end gap-3 pt-2'>
                <Button type='button' variant='outline' size='sm' asChild>
                  <Link href='/client/tickets'>Cancelar</Link>
                </Button>
                <Button type='submit' size='sm' disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className='h-3.5 w-3.5 mr-1.5 animate-spin' />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Ticket className='h-3.5 w-3.5 mr-1.5' />
                      Crear Ticket
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
