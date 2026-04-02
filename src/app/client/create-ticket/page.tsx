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
import { Ticket, AlertCircle, CheckCircle, Loader2, ArrowLeft, Upload, File, X, Paperclip } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { FilePreviewList } from '@/components/tickets/file-preview-list'

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
  LOW: 'text-green-600',
  MEDIUM: 'text-yellow-600',
  HIGH: 'text-orange-600',
  URGENT: 'text-red-600',
}

export default function CreateTicketPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null)

  // --- Family selection (Step 0) ---
  const [families, setFamilies] = useState<Array<{ id: string; name: string; code: string; color?: string; description?: string }>>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [familyStep, setFamilyStep] = useState<'loading' | 'select' | 'done'>('loading')
  
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

    // Load families first
    loadFamilies()
  }, [session, status, router])

  const loadFamilies = async () => {
    try {
      const response = await fetch('/api/families?ticketsEnabled=true')
      if (response.ok) {
        const result = await response.json()
        if (result.success && Array.isArray(result.data)) {
          const enabledFamilies = result.data.filter((f: any) => f.isActive)
          setFamilies(enabledFamilies)
          if (enabledFamilies.length === 1) {
            // Auto-select single family and skip step
            setSelectedFamilyId(enabledFamilies[0].id)
            setFamilyStep('done')
            await loadCategories(enabledFamilies[0].id)
          } else if (enabledFamilies.length === 0) {
            // No families — load all categories as fallback
            setFamilyStep('done')
            await loadCategories(null)
          } else {
            setFamilyStep('select')
            setIsLoading(false)
          }
          return
        }
      }
    } catch (error) {
      console.error('Error loading families:', error)
    }
    // Fallback: skip family step
    setFamilyStep('done')
    await loadCategories(null)
  }

  const loadCategories = async (familyId: string | null) => {
    try {
      const url = familyId
        ? `/api/categories?isActive=true&familyId=${familyId}`
        : '/api/categories?isActive=true'
      const response = await fetch(url)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setCategories(result.data)
          const level1Categories = result.data.filter((cat: Category) => cat.level === 1)
          setAvailableCategories(prev => ({
            ...prev,
            level1: level1Categories
          }))
        }
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las categorías',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFamilySelect = async (familyId: string) => {
    setSelectedFamilyId(familyId)
    setFamilyStep('done')
    setIsLoading(true)
    await loadCategories(familyId)
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
    
    // Actualizar el valor del formulario con la categoría más específica
    const finalCategoryId = newSelections.level4 || newSelections.level3 || newSelections.level2 || newSelections.level1
    if (finalCategoryId) {
      setValue('categoryId', finalCategoryId)
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
    setSubmitSuccess(false)

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          ...(selectedFamilyId ? { familyId: selectedFamilyId } : {}),
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const ticketId = result.data.id
        setCreatedTicketId(ticketId)
        
        // Subir archivos si hay
        await uploadFiles(ticketId)
        
        setSubmitSuccess(true)

        toast({
          title: 'Éxito',
          description: 'Ticket creado exitosamente'
        })

        // Redirigir después de 2 segundos
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
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  // Step 0: Family selection
  if (familyStep === 'select') {
    return (
      <RoleDashboardLayout title='Crear Ticket' subtitle='Selecciona el área de soporte'>
        <div className='max-w-2xl mx-auto'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Ticket className='h-5 w-5 mr-2 text-blue-600' />
                ¿A qué área pertenece tu solicitud?
              </CardTitle>
              <CardDescription>
                Selecciona la familia de soporte para tu ticket
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                {families.map(family => (
                  <button
                    key={family.id}
                    onClick={() => handleFamilySelect(family.id)}
                    className='flex items-start space-x-3 p-4 border-2 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all text-left'
                  >
                    {family.color && (
                      <div className='w-4 h-4 rounded-full flex-shrink-0 mt-1' style={{ backgroundColor: family.color }} />
                    )}
                    <div>
                      <p className='font-semibold text-foreground'>{family.name}</p>
                      {family.description && (
                        <p className='text-xs text-muted-foreground mt-1'>{family.description}</p>
                      )}
                      <Badge variant='outline' className='text-xs mt-2'>{family.code}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
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
                Tu solicitud ha sido enviada y será atendida por nuestro equipo de soporte.
                Recibirás notificaciones sobre el progreso de tu ticket.
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
      <Link href='/client'>
        <ArrowLeft className='h-4 w-4 mr-2' />
        Volver
      </Link>
    </Button>
  )

  return (
    <RoleDashboardLayout
      title='Crear Nuevo Ticket'
      subtitle='Solicita ayuda de nuestro equipo de soporte'
      headerActions={headerActions}
    >
      <div className='max-w-4xl mx-auto'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center'>
              <Ticket className='h-5 w-5 mr-2 text-blue-600' />
              Nueva Solicitud de Soporte
            </CardTitle>
            <CardDescription>
              Completa el formulario con los detalles de tu problema o solicitud. Nuestro equipo te
              ayudará lo antes posible.
            </CardDescription>
            {selectedFamilyId && families.length > 1 && (
              <div className='flex items-center space-x-2 mt-2'>
                {(() => {
                  const fam = families.find(f => f.id === selectedFamilyId)
                  return fam ? (
                    <div className='flex items-center space-x-2'>
                      {fam.color && <div className='w-3 h-3 rounded-full' style={{ backgroundColor: fam.color }} />}
                      <Badge variant='outline'>{fam.name}</Badge>
                      <button
                        type='button'
                        className='text-xs text-blue-600 underline'
                        onClick={() => {
                          setSelectedFamilyId(null)
                          setFamilyStep('select')
                          setSelectedCategories({})
                          setAvailableCategories({ level1: [], level2: [], level3: [], level4: [] })
                        }}
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
              {/* Título */}
              <div className='space-y-2'>
                <Label htmlFor='title'>Título del Ticket *</Label>
                <Input
                  id='title'
                  placeholder='Describe brevemente tu problema o solicitud'
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
                  placeholder='Proporciona todos los detalles relevantes sobre tu problema o solicitud. Incluye pasos para reproducir el problema, mensajes de error, etc.'
                  rows={6}
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
                    <SelectTrigger className={errors.priority ? 'border-red-500' : ''}>
                      <SelectValue placeholder='Selecciona la prioridad' />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          <div className='flex items-center space-x-2'>
                            <div
                              className={`w-2 h-2 rounded-full ${
                                value === 'LOW'
                                  ? 'bg-green-500'
                                  : value === 'MEDIUM'
                                    ? 'bg-yellow-500'
                                    : value === 'HIGH'
                                      ? 'bg-orange-500'
                                      : 'bg-red-500'
                              }`}
                            />
                            <span className={priorityColors[value as keyof typeof priorityColors]}>
                              {label}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.priority && (
                    <p className='text-sm text-red-600'>{errors.priority.message}</p>
                  )}
                  <p className='text-xs text-muted-foreground'>
                    {selectedPriority === 'LOW' && 'Para consultas generales o mejoras no urgentes'}
                    {selectedPriority === 'MEDIUM' &&
                      'Para problemas que afectan el trabajo pero tienen soluciones alternativas'}
                    {selectedPriority === 'HIGH' &&
                      'Para problemas que impactan significativamente el trabajo'}
                    {selectedPriority === 'URGENT' &&
                      'Para problemas críticos que bloquean completamente el trabajo'}
                  </p>
                </div>

                {/* Categorías en Cascada */}
                <div className='space-y-4'>
                  <Label className='flex items-center'>
                    Categoría del Problema *
                  </Label>
                  
                  {/* Nivel 1 - Categoría Principal */}
                  <div className='space-y-2'>
                    <Label htmlFor='category-level-1' className='text-sm font-medium'>
                      1. Categoría Principal
                    </Label>
                    <Select 
                      value={selectedCategories.level1 || ''} 
                      onValueChange={(value) => handleCategorySelect(1, value)}
                    >
                      <SelectTrigger className={errors.categoryId && !selectedCategories.level1 ? 'border-red-500' : ''}>
                        <SelectValue placeholder='Selecciona la categoría principal' />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.level1.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className='flex items-center space-x-2'>
                              <div
                                className='w-3 h-3 rounded-full flex-shrink-0'
                                style={{ backgroundColor: category.color }}
                              />
                              <span>{category.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Nivel 2 - Subcategoría */}
                  {selectedCategories.level1 && availableCategories.level2.length > 0 && (
                    <div className='space-y-2 pl-4 border-l-2 border-blue-200'>
                      <Label htmlFor='category-level-2' className='text-sm font-medium'>
                        2. Subcategoría
                      </Label>
                      <Select 
                        value={selectedCategories.level2 || ''} 
                        onValueChange={(value) => handleCategorySelect(2, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Selecciona la subcategoría' />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCategories.level2.map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className='flex items-center space-x-2'>
                                <div
                                  className='w-3 h-3 rounded-full flex-shrink-0'
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

                  {/* Nivel 3 - Especialidad */}
                  {selectedCategories.level2 && availableCategories.level3.length > 0 && (
                    <div className='space-y-2 pl-8 border-l-2 border-green-200'>
                      <Label htmlFor='category-level-3' className='text-sm font-medium'>
                        3. Especialidad
                      </Label>
                      <Select 
                        value={selectedCategories.level3 || ''} 
                        onValueChange={(value) => handleCategorySelect(3, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Selecciona la especialidad' />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCategories.level3.map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className='flex items-center space-x-2'>
                                <div
                                  className='w-3 h-3 rounded-full flex-shrink-0'
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

                  {/* Nivel 4 - Detalle */}
                  {selectedCategories.level3 && availableCategories.level4.length > 0 && (
                    <div className='space-y-2 pl-12 border-l-2 border-purple-200'>
                      <Label htmlFor='category-level-4' className='text-sm font-medium'>
                        4. Detalle Específico
                      </Label>
                      <Select 
                        value={selectedCategories.level4 || ''} 
                        onValueChange={(value) => handleCategorySelect(4, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Selecciona el detalle específico' />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCategories.level4.map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className='flex items-center space-x-2'>
                                <div
                                  className='w-3 h-3 rounded-full flex-shrink-0'
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

                  {/* Mensaje de error */}
                  {errors.categoryId && (
                    <p className='text-sm text-red-600'>{errors.categoryId.message}</p>
                  )}
                  
                  {/* Ruta de navegación */}
                  {selectedCategories.level1 && (
                    <div className='p-3 bg-muted rounded-lg'>
                      <p className='text-xs font-medium text-foreground mb-1'>Ruta seleccionada:</p>
                      <div className='flex items-center space-x-2 text-xs text-muted-foreground'>
                        {availableCategories.level1.find(c => c.id === selectedCategories.level1)?.name}
                        {selectedCategories.level2 && (
                          <>
                            <span>→</span>
                            {availableCategories.level2.find(c => c.id === selectedCategories.level2)?.name}
                          </>
                        )}
                        {selectedCategories.level3 && (
                          <>
                            <span>→</span>
                            {availableCategories.level3.find(c => c.id === selectedCategories.level3)?.name}
                          </>
                        )}
                        {selectedCategories.level4 && (
                          <>
                            <span>→</span>
                            {availableCategories.level4.find(c => c.id === selectedCategories.level4)?.name}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

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

                {selectedFiles.length > 0 && (
                  <FilePreviewList files={selectedFiles} onRemove={removeFile} />
                )}
              </div>

              {/* Información adicional */}
              <Alert>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>
                  <strong>Consejos para una mejor atención:</strong>
                  <ul className='mt-2 space-y-1 text-sm'>
                    <li>• Sé específico en la descripción del problema</li>
                    <li>• Incluye capturas de pantalla si es relevante</li>
                    <li>• Menciona qué navegador o sistema operativo usas</li>
                    <li>• Indica si el problema es recurrente o puntual</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Botones */}
              <div className='flex items-center justify-end space-x-4 pt-6 border-t'>
                <Button type='button' variant='outline' asChild>
                  <Link href='/client'>Cancelar</Link>
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
      </div>
    </RoleDashboardLayout>
  )
}
