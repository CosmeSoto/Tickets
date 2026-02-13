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

interface Category {
  id: string
  name: string
  description?: string
  color: string
  level: number
  parentId?: string
  children: Category[]
}

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
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null)
  
  // Estados para selección en cascada de categorías
  const [selectedCategories, setSelectedCategories] = useState<{
    level1?: string
    level2?: string
    level3?: string
    level4?: string
  }>({})
  const [availableCategories, setAvailableCategories] = useState<{
    level1: Category[]
    level2: Category[]
    level3: Category[]
    level4: Category[]
  }>({
    level1: [],
    level2: [],
    level3: [],
    level4: []
  })
  
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
      clientId: session?.user?.id, // Auto-asignar el cliente actual
    },
  })

  const selectedPriority = watch('priority')

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

    // Cargar categorías
    loadCategories()
  }, [session, status, router, setValue])

  const loadCategories = async () => {
    try {
      setLoadError('')
      
      const response = await fetch('/api/categories?isActive=true')
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setCategories(result.data)
          // Obtener categorías de nivel 1
          const level1Categories = result.data.filter((cat: Category) => cat.level === 1)
          setAvailableCategories(prev => ({
            ...prev,
            level1: level1Categories
          }))
        }
      } else {
        setLoadError('Error al cargar las categorías')
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      setLoadError('Error de conexión al cargar las categorías')
    } finally {
      setIsLoading(false)
    }
  }

  // Manejar selección de categoría en cascada
  const handleCategorySelect = (level: number, categoryId: string) => {
    const findCategory = (cats: Category[], id: string): Category | null => {
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
    
    const finalCategoryId = newSelections.level4 || newSelections.level3 || newSelections.level2 || newSelections.level1
    if (finalCategoryId) {
      setValue('categoryId', finalCategoryId)
    }
  }

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
        
        setSubmitSuccess(true)

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

  if (status === 'loading' || isLoading) {
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
        {loadError && (
          <Alert variant='destructive' className='mb-6'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}
        
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
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
              {/* Título */}
              <div className='space-y-2'>
                <Label htmlFor='title'>Título *</Label>
                <Input
                  id='title'
                  placeholder='Describe brevemente tu problema'
                  {...register('title')}
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && <p className='text-sm text-red-600'>{errors.title.message}</p>}
              </div>

              {/* Descripción */}
              <div className='space-y-2'>
                <Label htmlFor='description'>Descripción Detallada *</Label>
                <Textarea
                  id='description'
                  placeholder='Proporciona todos los detalles relevantes sobre tu problema. Incluye pasos para reproducirlo, mensajes de error, etc.'
                  rows={8}
                  {...register('description')}
                  className={errors.description ? 'border-red-500' : ''}
                />
                {errors.description && (
                  <p className='text-sm text-red-600'>{errors.description.message}</p>
                )}
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                {/* Prioridad */}
                <div className='space-y-2'>
                  <Label htmlFor='priority'>Prioridad *</Label>
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
                  {selectedPriority && (
                    <div className={`p-3 rounded-lg text-xs ${priorityColors[selectedPriority as keyof typeof priorityColors]}`}>
                      <strong>{priorityLabels[selectedPriority as keyof typeof priorityLabels]}:</strong> {priorityDescriptions[selectedPriority as keyof typeof priorityDescriptions]}
                    </div>
                  )}
                </div>

                {/* Categorías */}
                <div className='space-y-4'>
                  <Label>Categoría *</Label>
                  
                  {/* Nivel 1 */}
                  <div className='space-y-2'>
                    <Label htmlFor='category-level-1' className='text-sm'>
                      1. Categoría Principal
                    </Label>
                    <Select 
                      value={selectedCategories.level1 || ''} 
                      onValueChange={(value) => handleCategorySelect(1, value)}
                    >
                      <SelectTrigger className={errors.categoryId && !selectedCategories.level1 ? 'border-red-500' : ''}>
                        <SelectValue placeholder='Selecciona una categoría' />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.level1.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className='flex items-center space-x-2'>
                              <div
                                className='w-3 h-3 rounded-full'
                                style={{ backgroundColor: category.color }}
                              />
                              <span>{category.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Nivel 2 */}
                  {selectedCategories.level1 && availableCategories.level2.length > 0 && (
                    <div className='space-y-2 pl-4 border-l-2 border-primary/20'>
                      <Label htmlFor='category-level-2' className='text-sm'>
                        2. Subcategoría
                      </Label>
                      <Select 
                        value={selectedCategories.level2 || ''} 
                        onValueChange={(value) => handleCategorySelect(2, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Selecciona una subcategoría' />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCategories.level2.map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className='flex items-center space-x-2'>
                                <div
                                  className='w-3 h-3 rounded-full'
                                  style={{ backgroundColor: category.color }}
                                />
                                <span>{category.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Nivel 3 */}
                  {selectedCategories.level2 && availableCategories.level3.length > 0 && (
                    <div className='space-y-2 pl-8 border-l-2 border-primary/20'>
                      <Label htmlFor='category-level-3' className='text-sm'>
                        3. Especialidad
                      </Label>
                      <Select 
                        value={selectedCategories.level3 || ''} 
                        onValueChange={(value) => handleCategorySelect(3, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Selecciona una especialidad' />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCategories.level3.map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className='flex items-center space-x-2'>
                                <div
                                  className='w-3 h-3 rounded-full'
                                  style={{ backgroundColor: category.color }}
                                />
                                <span>{category.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Nivel 4 */}
                  {selectedCategories.level3 && availableCategories.level4.length > 0 && (
                    <div className='space-y-2 pl-12 border-l-2 border-primary/20'>
                      <Label htmlFor='category-level-4' className='text-sm'>
                        4. Detalle
                      </Label>
                      <Select 
                        value={selectedCategories.level4 || ''} 
                        onValueChange={(value) => handleCategorySelect(4, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Selecciona el detalle' />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCategories.level4.map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className='flex items-center space-x-2'>
                                <div
                                  className='w-3 h-3 rounded-full'
                                  style={{ backgroundColor: category.color }}
                                />
                                <span>{category.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {errors.categoryId && <p className='text-sm text-red-600'>{errors.categoryId.message}</p>}
                </div>
              </div>

              {/* Archivos Adjuntos */}
              <div className='space-y-2'>
                <Label>Archivos Adjuntos (Opcional)</Label>
                <div className='border-2 border-dashed border-border rounded-lg p-6'>
                  <input
                    ref={fileInputRef}
                    type='file'
                    multiple
                    onChange={handleFileSelect}
                    className='hidden'
                    accept='image/*,.pdf,.doc,.docx,.txt'
                  />
                  <div className='text-center'>
                    <Upload className='h-8 w-8 mx-auto mb-2 text-muted-foreground' />
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className='h-4 w-4 mr-2' />
                      Seleccionar Archivos
                    </Button>
                    <p className='text-xs text-muted-foreground mt-2'>
                      Máximo 5 archivos, 10MB cada uno
                    </p>
                  </div>
                </div>

                {selectedFiles.length > 0 && (
                  <div className='space-y-2 mt-4'>
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className='flex items-center justify-between p-3 bg-muted rounded-lg'
                      >
                        <div className='flex items-center space-x-2'>
                          <File className='h-4 w-4 text-muted-foreground' />
                          <span className='text-sm'>{file.name}</span>
                          <span className='text-xs text-muted-foreground'>
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
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
              <div className='flex items-center justify-end space-x-4 pt-4'>
                <Button type='button' variant='outline' asChild>
                  <Link href='/client/tickets'>Cancelar</Link>
                </Button>
                <Button type='submit' disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Creando...
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
      </div>
    </RoleDashboardLayout>
  )
}
