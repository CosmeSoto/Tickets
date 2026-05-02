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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  MapPin,
  Info,
  Layers,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { CategorySelectorWrapper } from '@/features/category-selection'

interface FamilyOption {
  id: string
  name: string
  code: string
  color?: string | null
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300',
}

export default function TechnicianCreateTicketPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Familias donde el técnico actúa como CLIENTE (para crear solicitudes)
  const [clientFamilies, setClientFamilies] = useState<FamilyOption[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')
  const [loadingFamilies, setLoadingFamilies] = useState(true)

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

  // Cargar familias donde el técnico puede crear tickets como cliente
  // Usa el endpoint /api/families que ya filtra por rol, pero necesitamos
  // las familias de cliente: familia nativa del depto + client_family_assignments
  useEffect(() => {
    const fetchClientFamilies = async () => {
      try {
        // asClient=true indica que queremos las familias donde actuamos como cliente
        const res = await fetch('/api/families?asClient=true')
        if (res.ok) {
          const json = await res.json()
          const families: FamilyOption[] = json.data ?? []
          setClientFamilies(families)
          // Pre-seleccionar la primera familia si solo hay una
          if (families.length === 1) {
            setSelectedFamilyId(families[0].id)
          }
        }
      } catch {
        // silencioso
      } finally {
        setLoadingFamilies(false)
      }
    }
    fetchClientFamilies()
  }, [])

  // Limpiar categoría al cambiar de familia
  const handleFamilyChange = (familyId: string) => {
    setSelectedFamilyId(familyId)
    setValue('categoryId', '')
  }

  const onSubmit = async (data: CreateTicketData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          familyId: selectedFamilyId || undefined,
          // No enviar clientId — el servidor usa session.user.id para TECHNICIAN
          // No enviar assigneeId — no puede auto-asignarse
          clientId: undefined,
          assigneeId: undefined,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setSubmitSuccess(true)
        window.dispatchEvent(new CustomEvent('ticket-created'))
        toast({ title: 'Solicitud enviada', description: 'Tu ticket fue registrado correctamente' })
        setTimeout(() => router.push(`/technician/tickets/${result.data.id}`), 1500)
      } else {
        const error = await response.json()
        toast({
          title: 'Error al crear ticket',
          description: error.message || 'Intenta nuevamente',
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
      <ModuleLayout title='Solicitud Enviada' subtitle='Ticket registrado'>
        <Card className='max-w-lg mx-auto'>
          <CardContent className='pt-8 pb-8 text-center space-y-4'>
            <CheckCircle className='h-14 w-14 text-emerald-500 mx-auto' />
            <h2 className='text-xl font-semibold'>¡Solicitud enviada!</h2>
            <p className='text-muted-foreground text-sm'>
              Tu solicitud fue registrada. Un técnico o administrador la revisará y asignará pronto.
            </p>
            <Button asChild className='w-full'>
              <Link href='/technician/tickets'>Ver tickets asignados</Link>
            </Button>
          </CardContent>
        </Card>
      </ModuleLayout>
    )
  }

  return (
    <ModuleLayout
      title='Nueva Solicitud'
      subtitle='Crea un ticket de soporte para ti mismo — será atendido por otro técnico o administrador'
      headerActions={
        <Button variant='outline' asChild>
          <Link href='/technician/tickets'>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Volver
          </Link>
        </Button>
      }
    >
      <div className='max-w-3xl mx-auto space-y-6'>
        {/* Aviso informativo */}
        <Alert className='border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800'>
          <Info className='h-4 w-4 text-blue-600 dark:text-blue-400' />
          <AlertDescription className='text-blue-800 dark:text-blue-300 text-sm'>
            Estás creando una solicitud como <strong>{session?.user?.name}</strong>. El ticket será
            asignado a otro técnico o administrador — no puedes atender tus propias solicitudes.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Ticket className='h-5 w-5 text-primary' />
              Detalles de la Solicitud
            </CardTitle>
            <CardDescription>
              Describe el problema con el mayor detalle posible para agilizar la resolución.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
              {/* ── Área de soporte ─────────────────────────────────────── */}
              <div className='space-y-1.5'>
                <Label className='flex items-center gap-1.5 text-sm font-semibold'>
                  <Layers className='h-4 w-4' />
                  Área de soporte <span className='text-destructive'>*</span>
                </Label>
                <p className='text-xs text-muted-foreground'>
                  Selecciona el área a la que diriges tu solicitud.
                </p>
                {loadingFamilies ? (
                  <div className='flex items-center gap-2 text-sm text-muted-foreground py-2'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Cargando áreas disponibles...
                  </div>
                ) : clientFamilies.length === 0 ? (
                  <Alert variant='destructive'>
                    <AlertCircle className='h-4 w-4' />
                    <AlertDescription>
                      No tienes áreas de soporte asignadas. Contacta al administrador.
                    </AlertDescription>
                  </Alert>
                ) : clientFamilies.length === 1 ? (
                  // Una sola familia: mostrar como badge informativo, no como selector
                  <div className='flex items-center gap-2 p-3 rounded-lg border bg-muted/30'>
                    {clientFamilies[0].color && (
                      <span
                        className='w-3 h-3 rounded-full flex-shrink-0'
                        style={{ backgroundColor: clientFamilies[0].color }}
                      />
                    )}
                    <span className='text-sm font-medium'>{clientFamilies[0].name}</span>
                    <Badge variant='outline' className='text-xs font-mono ml-auto'>
                      {clientFamilies[0].code}
                    </Badge>
                  </div>
                ) : (
                  <Select value={selectedFamilyId} onValueChange={handleFamilyChange}>
                    <SelectTrigger>
                      <SelectValue placeholder='Selecciona el área de soporte...' />
                    </SelectTrigger>
                    <SelectContent>
                      {clientFamilies.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          <div className='flex items-center gap-2'>
                            {f.color && (
                              <span
                                className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                                style={{ backgroundColor: f.color }}
                              />
                            )}
                            <span>{f.name}</span>
                            <span className='text-xs text-muted-foreground font-mono ml-1'>
                              {f.code}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              {/* ── Título ──────────────────────────────────────────────── */}
              <div className='space-y-1.5'>
                <Label htmlFor='title'>
                  Título <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='title'
                  placeholder='Ej: Impresora del piso 3 no responde'
                  {...register('title')}
                  className={errors.title ? 'border-destructive' : ''}
                />
                {errors.title && (
                  <p className='text-xs text-destructive flex items-center gap-1'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* ── Descripción ─────────────────────────────────────────── */}
              <div className='space-y-1.5'>
                <Label htmlFor='description'>
                  Descripción <span className='text-destructive'>*</span>
                </Label>
                <Textarea
                  id='description'
                  placeholder='Describe qué ocurre, desde cuándo, qué intentaste hacer y cualquier mensaje de error...'
                  rows={5}
                  {...register('description')}
                  className={errors.description ? 'border-destructive' : ''}
                />
                {errors.description && (
                  <p className='text-xs text-destructive flex items-center gap-1'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* ── Ubicación ───────────────────────────────────────────── */}
              <div className='space-y-1.5'>
                <Label htmlFor='location' className='flex items-center gap-1.5'>
                  <MapPin className='h-3.5 w-3.5' />
                  Ubicación
                  <span className='text-muted-foreground font-normal text-xs'>(opcional)</span>
                </Label>
                <Input
                  id='location'
                  placeholder='Ej: Sala de servidores, Piso 2, Oficina 301...'
                  {...register('location')}
                />
              </div>

              {/* ── Prioridad ───────────────────────────────────────────── */}
              <div className='space-y-1.5'>
                <Label>
                  Prioridad <span className='text-destructive'>*</span>
                </Label>
                <Select
                  value={selectedPriority}
                  onValueChange={v => setValue('priority', v as TicketPriority)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Selecciona la prioridad' />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div className='flex items-center gap-2'>
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              value === 'LOW'
                                ? 'bg-emerald-500'
                                : value === 'MEDIUM'
                                  ? 'bg-amber-500'
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
                  <div
                    className={`text-xs px-3 py-1.5 rounded-md border ${PRIORITY_COLORS[selectedPriority]}`}
                  >
                    {selectedPriority === 'LOW' && 'Consulta general o mejora no urgente'}
                    {selectedPriority === 'MEDIUM' &&
                      'Problema con solución alternativa disponible'}
                    {selectedPriority === 'HIGH' && 'Impacta significativamente el trabajo'}
                    {selectedPriority === 'URGENT' && 'Bloquea completamente el trabajo — crítico'}
                  </div>
                )}
              </div>

              <Separator />

              {/* ── Categoría ───────────────────────────────────────────── */}
              <div className='space-y-1.5'>
                <Label className='flex items-center gap-1.5 text-sm font-semibold'>
                  <Tag className='h-4 w-4' />
                  Categoría <span className='text-destructive'>*</span>
                </Label>
                <p className='text-xs text-muted-foreground'>
                  Selecciona la categoría más específica que describa el problema.
                  {!selectedFamilyId && clientFamilies.length > 1 && (
                    <span className='text-amber-600 dark:text-amber-400 ml-1'>
                      Selecciona primero el área de soporte.
                    </span>
                  )}
                </p>
                <div className='border rounded-lg p-3 bg-muted/20'>
                  <CategorySelectorWrapper
                    value={selectedCategoryId}
                    onChange={categoryId => setValue('categoryId', categoryId)}
                    ticketTitle={ticketTitle || ''}
                    ticketDescription={ticketDescription || ''}
                    clientId={session?.user?.id || ''}
                    familyId={selectedFamilyId || undefined}
                    error={errors.categoryId?.message}
                  />
                </div>
              </div>

              {/* ── Botones ─────────────────────────────────────────────── */}
              <div className='flex items-center justify-end gap-3 pt-2'>
                <Button type='button' variant='outline' asChild>
                  <Link href='/technician/tickets'>Cancelar</Link>
                </Button>
                <Button
                  type='submit'
                  disabled={isSubmitting || loadingFamilies || clientFamilies.length === 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <FileText className='h-4 w-4 mr-2' />
                      Enviar Solicitud
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info adicional */}
        <Card className='border-dashed'>
          <CardContent className='pt-4 pb-4'>
            <div className='flex items-start gap-3'>
              <Info className='h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0' />
              <div className='space-y-1 text-xs text-muted-foreground'>
                <p className='font-medium text-foreground'>¿Qué pasa después?</p>
                <p>
                  • El ticket queda en estado <strong>Abierto</strong> sin asignar
                </p>
                <p>• Un administrador o técnico disponible lo tomará</p>
                <p>• Recibirás notificaciones cuando haya actualizaciones</p>
                <p>• Puedes agregar comentarios o archivos desde el detalle del ticket</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  )
}
