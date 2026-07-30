'use client'

/**
 * CreateTicketForm — Formulario unificado de creación de tickets.
 *
 * Usado por CLIENT, TECHNICIAN y ADMIN (cuando actúan como solicitante).
 * Las diferencias por rol se controlan mediante props:
 *   - familiesEndpoint: URL para cargar las familias disponibles
 *   - onSubmitData: callback que recibe los datos finales antes de enviar
 *   - afterSuccessHref: ruta a la que redirigir tras crear el ticket
 *   - infoAlert: mensaje informativo opcional (ej: aviso para técnicos)
 */

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createTicketSchema, CreateTicketData } from '@/lib/schemas/ticket-schemas'
import { TicketPriority } from '@prisma/client'
import {
  Ticket,
  CheckCircle,
  Loader2,
  Tag,
  Zap,
  Upload,
  Paperclip,
  MapPin,
  Info,
  Camera,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { CategorySelectorWrapper } from '@/features/category-selection'
import { FilePreviewList } from '@/components/tickets/file-preview-list'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'
import {
  TicketSupportAreaField,
  type TicketSupportAreaFamily,
} from '@/components/tickets/ticket-support-area-field'
import { ticketRequestFamiliesUrl } from '@/lib/utils/ticket-family'
import { pickDefaultTicketFamilyId } from '@/hooks/use-ticket-request-families'

export interface CreateTicketFormProps {
  /** URL del endpoint para cargar familias disponibles */
  familiesEndpoint?: string
  /** clientId a usar al enviar (undefined = el servidor lo infiere de la sesión) */
  clientId?: string
  /** Datos extra a mezclar en el body del POST */
  extraData?: Record<string, unknown>
  /** Ruta a la que redirigir tras crear el ticket (se añade el ticketId al final) */
  afterSuccessHref: string
  /** Ruta del botón "Cancelar" */
  cancelHref: string
  /** Mensaje informativo opcional (ej: aviso para técnicos) */
  infoAlert?: React.ReactNode
  /** Texto del botón de envío */
  submitLabel?: string
  /** Texto del título de la card */
  cardTitle?: string
  /** Texto de la descripción de la card */
  cardDescription?: string
  /** Mostrar consejos para crear un buen ticket */
  showTips?: boolean
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300 border-green-200 dark:border-green-500/40',
  MEDIUM:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/40',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300 border-orange-200 dark:border-orange-500/40',
  URGENT:
    'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300 border-red-200 dark:border-red-500/40',
}

const PRIORITY_DESCRIPTIONS: Record<string, string> = {
  LOW: 'Para consultas generales o mejoras no urgentes',
  MEDIUM: 'Para problemas que afectan el trabajo pero tienen soluciones alternativas',
  HIGH: 'Para problemas que impactan significativamente el trabajo',
  URGENT: 'Para problemas críticos que bloquean completamente el trabajo',
}

export function CreateTicketForm({
  familiesEndpoint = ticketRequestFamiliesUrl(),
  clientId,
  extraData,
  afterSuccessHref,
  cancelHref,
  infoAlert,
  submitLabel = 'Crear Ticket',
  cardTitle = 'Nueva Solicitud de Soporte',
  cardDescription = 'Completa el formulario con los detalles de tu problema o solicitud',
  showTips = true,
}: CreateTicketFormProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null)

  const [availableFamilies, setAvailableFamilies] = useState<TicketSupportAreaFamily[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const prevFamilyIdRef = useRef<string | null>(null)

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
    defaultValues: { priority: TicketPriority.MEDIUM },
  })

  const selectedPriority = watch('priority')
  const selectedCategoryId = watch('categoryId')
  const ticketTitle = watch('title')
  const ticketDescription = watch('description')

  // Cargar familias disponibles
  useEffect(() => {
    setLoadingFamilies(true)
    fetch(familiesEndpoint)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          const families: TicketSupportAreaFamily[] = d.data.map((f: any) => ({
            id: f.id,
            name: f.name,
            code: f.code,
            color: f.color,
            isOwnFamily: f.isOwnFamily ?? false,
            isUserFamily: f.isOwnFamily ?? false,
          }))
          setAvailableFamilies(families)
          const defaultId = pickDefaultTicketFamilyId(families)
          if (defaultId) setSelectedFamilyId(defaultId)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFamilies(false))
  }, [familiesEndpoint])

  // Resetear categoría al cambiar familia
  useEffect(() => {
    if (prevFamilyIdRef.current !== selectedFamilyId) {
      prevFamilyIdRef.current = selectedFamilyId
      if (selectedCategoryId) setValue('categoryId', '')
    }
  }, [selectedFamilyId, selectedCategoryId, setValue])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    processFiles(files)
  }

  const removeFile = (index: number) => setSelectedFiles(prev => prev.filter((_, i) => i !== index))

  const processFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files)
    if (selectedFiles.length + newFiles.length > 5) {
      toast({ title: 'Límite excedido', description: 'Máximo 5 archivos', variant: 'destructive' })
      return
    }
    if (newFiles.some(f => f.size > 10 * 1024 * 1024)) {
      toast({
        title: 'Archivo muy grande',
        description: 'Máximo 10MB por archivo',
        variant: 'destructive',
      })
      return
    }
    setSelectedFiles(prev => [...prev, ...newFiles])
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

  const uploadFiles = async (ticketId: string) => {
    for (const file of selectedFiles) {
      const fd = new FormData()
      fd.append('file', file)
      await fetch(`/api/tickets/${ticketId}/attachments`, { method: 'POST', body: fd }).catch(
        () => {}
      )
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
      const body: Record<string, unknown> = {
        ...data,
        familyId: selectedFamilyId,
        ...(clientId ? { clientId } : {}),
        ...(extraData ?? {}),
      }

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const result = await res.json()
        const ticketId = result.data.id
        setCreatedTicketId(ticketId)
        await uploadFiles(ticketId)
        setSubmitSuccess(true)
        window.dispatchEvent(new CustomEvent('ticket-created'))
        toast({ title: 'Ticket creado', description: 'Tu solicitud fue registrada correctamente' })
        setTimeout(() => router.push(`${afterSuccessHref}/${ticketId}`), 1800)
      } else {
        const err = await res.json().catch(() => ({}))
        toast({
          title: 'Error',
          description: err.error || err.message || 'Error al crear el ticket',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitSuccess) {
    return (
      <Card className='max-w-lg mx-auto'>
        <CardContent className='pt-8 pb-8 text-center space-y-4'>
          <CheckCircle className='h-14 w-14 text-emerald-500 mx-auto' />
          <h2 className='text-xl font-semibold'>¡Ticket creado!</h2>
          <p className='text-muted-foreground text-sm'>
            Tu solicitud fue registrada. El equipo de soporte la atenderá pronto.
          </p>
          <Button asChild className='w-full'>
            <Link href={cancelHref}>Ver mis tickets</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='max-w-4xl mx-auto space-y-4'>
      {/* Aviso informativo (ej: para técnicos) */}
      {infoAlert && (
        <Alert className='border-blue-200 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/40'>
          <Info className='h-4 w-4 text-blue-600 dark:text-blue-400' />
          <AlertDescription className='text-blue-800 dark:text-blue-300 text-sm'>
            {infoAlert}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Ticket className='h-5 w-5 text-primary' />
            {cardTitle}
          </CardTitle>
          <CardDescription>{cardDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
            {/* ── Área de soporte (primero: define categorías y sugerencias) ── */}
            <TicketSupportAreaField
              families={availableFamilies}
              loading={loadingFamilies}
              value={selectedFamilyId ?? ''}
              onValueChange={v => setSelectedFamilyId(v || null)}
              emptyMessage='No tienes áreas de soporte disponibles. Contacta al administrador para que te asigne una familia.'
              labelClassName='flex items-center gap-1.5 text-sm font-semibold'
            />

            <Separator />

            {/* ── Título ──────────────────────────────────────────────── */}
            <div className='space-y-1.5'>
              <Label htmlFor='title'>
                Título del Ticket <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='title'
                {...register('title')}
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && <p className='text-xs text-destructive'>{errors.title.message}</p>}
            </div>

            {/* ── Descripción ─────────────────────────────────────────── */}
            <div className='space-y-1.5'>
              <Label htmlFor='description'>
                Descripción Detallada <span className='text-destructive'>*</span>
              </Label>
              <Textarea
                id='description'
                rows={4}
                {...register('description')}
                className={errors.description ? 'border-destructive' : ''}
              />
              {errors.description && (
                <p className='text-xs text-destructive'>{errors.description.message}</p>
              )}
            </div>

            {/* ── Ubicación ───────────────────────────────────────────── */}
            <div className='space-y-1.5'>
              <Label htmlFor='location' className='flex items-center gap-1.5'>
                <MapPin className='h-3.5 w-3.5' />
                Ubicación / Área
                <span className='text-muted-foreground font-normal text-xs'>(opcional)</span>
              </Label>
              <Input id='location' {...register('location')} />
            </div>

            {/* ── Prioridad ───────────────────────────────────────────── */}
            <div className='space-y-1.5'>
              <Label className='flex items-center gap-1.5'>
                <Zap className='h-3.5 w-3.5' />
                Prioridad <span className='text-destructive'>*</span>
              </Label>
              <Select
                value={selectedPriority}
                onValueChange={v => setValue('priority', v as TicketPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <div className='flex items-center gap-2'>
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
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPriority && (
                <p
                  className={`px-2 py-1.5 rounded text-xs border ${PRIORITY_COLORS[selectedPriority]}`}
                >
                  <strong>{PRIORITY_LABELS[selectedPriority]}:</strong>{' '}
                  {PRIORITY_DESCRIPTIONS[selectedPriority]}
                </p>
              )}
            </div>

            {showTips && (
              <div className='border rounded-lg p-3 bg-muted/20'>
                <p className='text-xs font-semibold text-muted-foreground mb-1.5'>
                  Consejos rápidos:
                </p>
                <ul className='text-xs text-muted-foreground space-y-0.5'>
                  <li>• Usa un título claro y descriptivo</li>
                  <li>• Describe el problema con detalles</li>
                  <li>• Adjunta fotos o capturas si aplica</li>
                </ul>
              </div>
            )}

            <Separator />

            {/* ── Categoría (tras área + título para sugerencias) ─────── */}
            <div className='space-y-1.5'>
              <Label className='flex items-center gap-1.5 text-sm font-semibold'>
                <Tag className='h-4 w-4' />
                Categoría del Ticket <span className='text-destructive'>*</span>
              </Label>
              <div className='border rounded-lg p-3 bg-muted/30'>
                <CategorySelectorWrapper
                  value={selectedCategoryId}
                  onChange={categoryId => setValue('categoryId', categoryId)}
                  ticketTitle={ticketTitle || ''}
                  ticketDescription={ticketDescription || ''}
                  clientId={clientId || session?.user?.id || ''}
                  familyId={selectedFamilyId ?? undefined}
                  requireFamily
                  error={errors.categoryId?.message}
                />
              </div>
            </div>

            <Separator />

            {/* ── Archivos adjuntos ────────────────────────────────────── */}
            <div className='space-y-1.5'>
              <Label>
                Archivos Adjuntos{' '}
                <span className='text-muted-foreground font-normal text-xs'>(opcional)</span>
              </Label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 rounded-lg px-4 py-3 transition-all ${
                  isDragging
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-dashed border-border'
                }`}
              >
                <FileInputWithCamera
                  accept='image/*,.pdf,.doc,.docx,.txt'
                  multiple
                  onChange={handleFileSelect}
                >
                  {({ openFile, openCamera, showCamera }) => (
                    <div className='flex items-center justify-between gap-4 flex-wrap'>
                      <div className='flex items-center gap-3'>
                        <Upload className='h-5 w-5 text-muted-foreground flex-shrink-0' />
                        <p className='text-xs text-muted-foreground'>
                          {isDragging
                            ? 'Suelta los archivos aquí'
                            : 'Máximo 5 archivos, 10MB cada uno'}
                        </p>
                      </div>
                      <div className='flex items-center gap-2'>
                        {showCamera && (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => openCamera()}
                          >
                            <Camera className='h-3.5 w-3.5 mr-1.5' />
                            Cámara
                          </Button>
                        )}
                        <Button type='button' variant='outline' size='sm' onClick={openFile}>
                          <Paperclip className='h-3.5 w-3.5 mr-1.5' />
                          {showCamera ? 'Galería / Archivo' : 'Seleccionar'}
                        </Button>
                      </div>
                    </div>
                  )}
                </FileInputWithCamera>
              </div>
              {selectedFiles.length > 0 && (
                <FilePreviewList files={selectedFiles} onRemove={removeFile} />
              )}
            </div>

            {/* ── Botones ─────────────────────────────────────────────── */}
            <div className='flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                asChild
                className='w-full sm:w-auto'
              >
                <Link href={cancelHref}>Cancelar</Link>
              </Button>
              <Button
                type='submit'
                size='sm'
                disabled={isSubmitting || (!loadingFamilies && availableFamilies.length === 0)}
                className='w-full sm:w-auto'
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className='h-3.5 w-3.5 mr-1.5 animate-spin' />
                    Creando...
                  </>
                ) : (
                  <>
                    <Ticket className='h-3.5 w-3.5 mr-1.5' />
                    {submitLabel}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
