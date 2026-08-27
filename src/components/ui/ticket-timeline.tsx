'use client'

import { useState, useEffect, useMemo } from 'react'
import React from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { Button } from './button'
import { Textarea } from './textarea'
import { StatusBadge, PriorityBadge } from './status-badge'
import {
  Clock,
  User,
  MessageSquare,
  Settings,
  CheckCircle,
  AlertCircle,
  FileText,
  Star,
  Send,
  Paperclip,
  Upload,
  Calendar,
  Target,
  Eye,
  Download,
  Image as ImageIcon,
  File as FileIcon,
  Lock,
  Globe,
  PlayCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useTimeline, type TimelineEvent } from '@/hooks/use-timeline'
import { formatTimeAgo, formatExactDateTime } from '@/hooks/use-ticket-data'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { FilePreviewModal } from '@/components/tickets/file-preview-modal'
import { formatDuration } from '@/lib/utils/time-utils'
import { FormDraftBanner } from '@/components/common/form-draft-banner'
import { FormDraftKeys, useFormDraft } from '@/hooks/common/use-form-draft'
import { Alert, AlertDescription } from './alert'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AttachmentItem {
  id: string
  name: string
  size: number
  type?: string // campo del optimista (File.type)
  mimeType?: string // campo de la API
}

interface TicketTimelineProps {
  ticketId: string
  canAddComments?: boolean
  canViewInternal?: boolean
  refreshKey?: number
  onCommentAdded?: () => void
  onStopPolling?: (stopFn: () => void) => void
  ticketStatus?: string
  /** Admin/técnico: exige En progreso para comentar */
  requireInProgress?: boolean
}

// ─── Helpers globales (sin estado, reutilizables) ─────────────────────────────

/** Devuelve el mimeType normalizado de un adjunto (API o optimista) */
function getMime(file: AttachmentItem): string {
  return file.mimeType || file.type || 'application/octet-stream'
}

/** Emoji según tipo de archivo */
function fileEmoji(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️'
  if (mime === 'application/pdf') return '📄'
  if (mime.includes('sheet') || mime.includes('excel')) return '📊'
  if (mime.includes('word')) return '📝'
  return '📎'
}

/** Formatea bytes a KB/MB */
function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Componente AttachmentChip ─────────────────────────────────────────────────
// Chip reutilizable para mostrar un adjunto con preview y descarga.
// Se usa tanto en el timeline como en cualquier otro lugar que lo necesite.

interface AttachmentChipProps {
  file: AttachmentItem
  ticketId: string
  onPreview: (file: AttachmentItem) => void
}

function AttachmentChip({ file, ticketId, onPreview }: AttachmentChipProps) {
  const mime = getMime(file)
  const isPending = file.id?.startsWith('pending-')

  return (
    <div className='flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm max-w-xs'>
      <span className='text-base shrink-0'>{fileEmoji(mime)}</span>
      <span className='flex-1 truncate font-medium min-w-0'>{file.name}</span>
      <span className='text-muted-foreground text-xs shrink-0'>{fmtSize(file.size)}</span>
      {isPending ? (
        <span className='text-xs text-muted-foreground italic shrink-0'>subiendo…</span>
      ) : (
        <>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 w-6 p-0 shrink-0'
                  onClick={() => onPreview(file)}
                >
                  <Eye className='h-3 w-3' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Vista previa</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`/api/tickets/${ticketId}/attachments/${file.id}`}
                  download={file.name}
                  className='inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted shrink-0'
                >
                  <Download className='h-3 w-3' />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>Descargar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      )}
    </div>
  )
}

// ─── Componente principal TicketTimeline ──────────────────────────────────────

export function TicketTimeline({
  ticketId,
  canAddComments = false,
  canViewInternal = false,
  refreshKey = 0,
  onCommentAdded,
  onStopPolling,
  ticketStatus,
  requireInProgress = false,
}: TicketTimelineProps) {
  const { data: session } = useSession()
  const { events, loading, addComment, loadTimeline, setEvents, stopPolling } =
    useTimeline(ticketId)

  // Exponer stopPolling al padre para que lo llame antes de eliminar el ticket
  useEffect(() => {
    if (onStopPolling) onStopPolling(stopPolling)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPolling])
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [showAll, setShowAll] = useState(false)
  const [previewFile, setPreviewFile] = useState<{
    id: string
    originalName: string
    mimeType: string
    size: number
    url: string
  } | null>(null)

  const needsInProgress = requireInProgress && ticketStatus === 'OPEN' && canAddComments
  const canWriteComment = canAddComments && !needsInProgress

  const commentDraftValues = useMemo(
    () => ({ content: newComment, isInternal }),
    [newComment, isInternal]
  )
  const { clearDraft, wasRestored, dismissRestoredBanner } = useFormDraft({
    key: FormDraftKeys.ticketComment(ticketId),
    values: commentDraftValues,
    enabled: canWriteComment && !submitting,
    onRestore: d => {
      if (typeof d.content === 'string') setNewComment(d.content)
      if (typeof d.isInternal === 'boolean') setIsInternal(d.isInternal)
    },
  })

  // Recargar cuando el padre lo pida (cambio de estado, asignación, etc.)
  useEffect(() => {
    if (refreshKey > 0) loadTimeline(true)
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Abrir modal de preview ──────────────────────────────────────────────────
  const openPreview = (file: AttachmentItem) => {
    if (file.id?.startsWith('pending-')) return
    setPreviewFile({
      id: file.id,
      originalName: file.name,
      mimeType: getMime(file),
      size: file.size,
      url: `/api/tickets/${ticketId}/attachments/${file.id}?preview=true`,
    })
  }

  // ── Enviar comentario ───────────────────────────────────────────────────────
  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setSubmitting(true)

    // Guardar datos del comentario antes de limpiar el form
    const commentContent = newComment
    const commentIsInternal = isInternal
    const commentAttachments = [...attachments]

    // Optimista: mostrar inmediatamente
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticEvent: TimelineEvent = {
      id: optimisticId,
      type: 'comment',
      title: commentIsInternal ? 'Comentario interno agregado' : 'Comentario agregado',
      description: commentContent,
      isInternal: commentIsInternal,
      user: {
        id: session?.user?.id || '',
        name: session?.user?.name || 'Tú',
        email: session?.user?.email || '',
        role: session?.user?.role || '',
      },
      createdAt: new Date().toISOString(),
      metadata:
        commentAttachments.length > 0
          ? {
              attachments: commentAttachments.map((f, i) => ({
                id: `pending-${i}`,
                name: f.name,
                size: f.size,
                type: f.type,
              })),
            }
          : undefined,
    }
    // Limpiar form inmediatamente para mejor UX
    setNewComment('')
    setIsInternal(false)
    setAttachments([])
    clearDraft()
    setEvents(prev => [optimisticEvent, ...prev])

    const result = await addComment(commentContent, commentIsInternal, commentAttachments)
    if (result) {
      // Actualizar ID del optimista inmediatamente con el real
      setEvents(prev =>
        prev.map(e =>
          e.id === optimisticId ? { ...e, id: result.id, createdAt: result.createdAt } : e
        )
      )
      // Recargar el timeline completo para traer datos reales del servidor
      // (adjuntos reales, metadata completa, etc.)
      loadTimeline(true)
      onCommentAdded?.()
    } else {
      // Revertir: restaurar form y quitar optimista
      setNewComment(commentContent)
      setIsInternal(commentIsInternal)
      setAttachments(commentAttachments)
      setEvents(prev => prev.filter(e => e.id !== optimisticId))
    }
    setSubmitting(false)
  }

  // ── Helpers de icono/color ──────────────────────────────────────────────────
  const getEventIcon = (type: TimelineEvent['type']) => {
    const icons: Record<string, React.ReactElement> = {
      comment: <MessageSquare className='h-4 w-4' />,
      status_change: <Settings className='h-4 w-4' />,
      assignment: <User className='h-4 w-4' />,
      priority_change: <AlertCircle className='h-4 w-4' />,
      resolution: <CheckCircle className='h-4 w-4' />,
      resolution_plan: <FileText className='h-4 w-4' />,
      resolution_task: <CheckCircle className='h-4 w-4' />,
      rating: <Star className='h-4 w-4' />,
      created: <FileText className='h-4 w-4' />,
      file_uploaded: <Paperclip className='h-4 w-4' />,
    }
    return icons[type] ?? <Clock className='h-4 w-4' />
  }

  const getEventColor = (type: TimelineEvent['type'], isInternal?: boolean) => {
    if (type === 'comment' && isInternal)
      return 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/50'
    const colors: Record<string, string> = {
      comment: 'text-blue-600 bg-blue-100',
      status_change: 'text-purple-600 bg-purple-100',
      assignment: 'text-green-600 bg-green-100',
      priority_change: 'text-orange-600 bg-orange-100',
      resolution: 'text-emerald-600 bg-emerald-100',
      resolution_plan: 'text-indigo-600 bg-indigo-100',
      resolution_task: 'text-cyan-600 bg-cyan-100',
      rating: 'text-yellow-600 bg-yellow-100',
      file_uploaded: 'text-teal-600 bg-teal-100',
    }
    return colors[type] ?? 'text-muted-foreground bg-muted'
  }

  // ── Metadata por tipo de evento ─────────────────────────────────────────────
  const renderEventMetadata = (event: TimelineEvent) => {
    const { metadata } = event
    if (!metadata) return null

    switch (event.type) {
      case 'status_change':
        return (
          <div className='flex items-center space-x-2 mt-2'>
            <StatusBadge status={metadata.oldValue as any} size='sm' />
            <span className='text-muted-foreground'>→</span>
            <StatusBadge status={metadata.newValue as any} size='sm' />
          </div>
        )

      case 'priority_change':
        return (
          <div className='flex items-center space-x-2 mt-2'>
            <PriorityBadge priority={metadata.oldValue as any} size='sm' />
            <span className='text-muted-foreground'>→</span>
            <PriorityBadge priority={metadata.newValue as any} size='sm' />
          </div>
        )

      case 'comment':
        if (!metadata.attachments?.length) return null
        return (
          <div className='mt-2 space-y-1'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              Archivos adjuntos ({metadata.attachments.length})
            </p>
            <div className='flex flex-wrap gap-2'>
              {metadata.attachments.map((file: AttachmentItem) => (
                <AttachmentChip
                  key={file.id}
                  file={file}
                  ticketId={ticketId}
                  onPreview={openPreview}
                />
              ))}
            </div>
          </div>
        )

      case 'file_uploaded':
        if (!metadata.attachments?.length) return null
        return (
          <div className='mt-2 flex flex-wrap gap-2'>
            {metadata.attachments.map((file: AttachmentItem) => (
              <AttachmentChip
                key={file.id}
                file={file}
                ticketId={ticketId}
                onPreview={openPreview}
              />
            ))}
          </div>
        )

      case 'rating':
        return (
          <div className='flex items-center space-x-1 mt-2'>
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                className={`h-4 w-4 ${star <= (metadata.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
              />
            ))}
            <span className='text-sm text-muted-foreground ml-2'>({metadata.rating}/5)</span>
          </div>
        )

      case 'resolution_plan': {
        // Determinar qué tipo de evento es para renderizar de forma apropiada
        const planAction = event.action

        // ── Plan eliminado: solo texto informativo ──────────────────────────
        if (planAction === 'resolution_plan_deleted') {
          return metadata.planTitle ? (
            <div className='mt-2 flex items-center gap-2 text-sm text-muted-foreground'>
              <FileText className='h-4 w-4 shrink-0' />
              <span className='italic'>&quot;{metadata.planTitle}&quot;</span>
            </div>
          ) : null
        }

        // ── Plan completado: card compacta con resultado ─────────────────────
        if (planAction === 'resolution_plan_completed') {
          return (
            <div className='mt-3 space-y-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800'>
              {metadata.planTitle && (
                <div className='flex items-start space-x-2'>
                  <CheckCircle className='h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0' />
                  <p className='font-semibold text-green-900 dark:text-green-100'>
                    {metadata.planTitle}
                  </p>
                </div>
              )}
              <div className='grid grid-cols-2 gap-3 text-sm'>
                {metadata.completedDate && (
                  <div className='flex items-center space-x-2'>
                    <CheckCircle className='h-4 w-4 text-green-600 dark:text-green-400' />
                    <div>
                      <span className='text-muted-foreground block text-xs'>Completado el</span>
                      <div className='font-medium text-green-700 dark:text-green-300'>
                        {new Date(metadata.completedDate).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {metadata.totalTasks !== undefined && (
                  <div className='flex items-center space-x-2'>
                    <CheckCircle className='h-4 w-4 text-green-600 dark:text-green-400' />
                    <div>
                      <span className='text-muted-foreground block text-xs'>Tareas</span>
                      <div className='font-medium text-green-700 dark:text-green-300'>
                        {metadata.completedTasks || 0} / {metadata.totalTasks} completadas
                      </div>
                    </div>
                  </div>
                )}
                {metadata.actualHours != null && metadata.actualHours > 0 && (
                  <div className='flex items-center space-x-2'>
                    <Clock className='h-4 w-4 text-green-600 dark:text-green-400' />
                    <div>
                      <span className='text-muted-foreground block text-xs'>Tiempo real</span>
                      <div className='font-medium text-green-700 dark:text-green-300'>
                        {formatDuration(metadata.actualHours)}
                      </div>
                    </div>
                  </div>
                )}
                {metadata.estimatedHours != null && metadata.estimatedHours > 0 && (
                  <div className='flex items-center space-x-2'>
                    <Clock className='h-4 w-4 text-muted-foreground' />
                    <div>
                      <span className='text-muted-foreground block text-xs'>Tiempo estimado</span>
                      <div className='font-medium'>{formatDuration(metadata.estimatedHours)}</div>
                    </div>
                  </div>
                )}
              </div>
              <div className='flex items-center space-x-2 pt-2 border-t border-green-200 dark:border-green-800'>
                <Badge className='text-xs bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40'>
                  ✅ Completado
                </Badge>
              </div>
            </div>
          )
        }

        // ── Plan actualizado: card compacta con el cambio ────────────────────
        if (planAction === 'resolution_plan_updated') {
          return (
            <div className='mt-3 space-y-2 p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800'>
              {metadata.planTitle && (
                <div className='flex items-start space-x-2'>
                  <FileText className='h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0' />
                  <p className='font-medium text-indigo-900 dark:text-indigo-100 text-sm'>
                    {metadata.planTitle}
                  </p>
                </div>
              )}
              {metadata.status && (
                <div className='flex items-center space-x-2'>
                  <Badge
                    variant='outline'
                    className={`text-xs ${
                      metadata.status === 'completed'
                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40'
                        : metadata.status === 'active'
                          ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40'
                          : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {metadata.status === 'draft' && '📝 Borrador'}
                    {metadata.status === 'active' && '🔄 Activo'}
                    {metadata.status === 'completed' && '✅ Completado'}
                    {metadata.status === 'cancelled' && '❌ Cancelado'}
                  </Badge>
                </div>
              )}
            </div>
          )
        }

        // ── Plan creado (default): tarjeta completa con todos los detalles ───
        return (
          <div className='mt-3 space-y-3 p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800'>
            {metadata.planTitle && (
              <div className='flex items-start space-x-2'>
                <FileText className='h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5' />
                <div>
                  <p className='font-semibold text-indigo-900 dark:text-indigo-100'>
                    {metadata.planTitle}
                  </p>
                  {(metadata as any).description && (
                    <p className='text-sm text-indigo-700 dark:text-indigo-300 mt-0.5'>
                      {(metadata as any).description}
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className='grid grid-cols-2 gap-3 text-sm'>
              {metadata.startDate && (
                <div className='flex items-center space-x-2'>
                  <Calendar className='h-4 w-4 text-indigo-600 dark:text-indigo-400' />
                  <div>
                    <span className='text-muted-foreground block text-xs'>Inicio programado</span>
                    <div className='font-medium text-indigo-700 dark:text-indigo-300'>
                      {new Date(metadata.startDate).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              )}
              {metadata.targetDate && (
                <div className='flex items-center space-x-2'>
                  <Target className='h-4 w-4 text-indigo-600 dark:text-indigo-400' />
                  <div>
                    <span className='text-muted-foreground block text-xs'>Fecha objetivo</span>
                    <div className='font-medium text-indigo-700 dark:text-indigo-300'>
                      {new Date(metadata.targetDate).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              )}
              {metadata.estimatedHours != null && metadata.estimatedHours > 0 && (
                <div className='flex items-center space-x-2'>
                  <Clock className='h-4 w-4 text-indigo-600 dark:text-indigo-400' />
                  <div>
                    <span className='text-muted-foreground block text-xs'>Tiempo estimado</span>
                    <div className='font-medium'>{formatDuration(metadata.estimatedHours)}</div>
                  </div>
                </div>
              )}
              {metadata.totalTasks !== undefined && (
                <div className='flex items-center space-x-2'>
                  <CheckCircle className='h-4 w-4 text-indigo-600 dark:text-indigo-400' />
                  <div>
                    <span className='text-muted-foreground block text-xs'>Progreso de tareas</span>
                    <div className='font-medium'>
                      {metadata.completedTasks || 0} de {metadata.totalTasks}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {metadata.status && (
              <div className='flex items-center space-x-2 pt-2 border-t border-indigo-200 dark:border-indigo-800'>
                <Badge
                  variant='outline'
                  className={`text-xs ${
                    metadata.status === 'completed'
                      ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40'
                      : metadata.status === 'active'
                        ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40'
                        : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {metadata.status === 'draft' && '📝 Borrador'}
                  {metadata.status === 'active' && '🔄 Activo'}
                  {metadata.status === 'completed' && '✅ Completado'}
                  {metadata.status === 'cancelled' && '❌ Cancelado'}
                </Badge>
              </div>
            )}
          </div>
        )
      }

      case 'resolution_task':
        return (
          <div className='mt-2 space-y-2 p-3 bg-cyan-50 dark:bg-cyan-950 rounded-lg border border-cyan-200 dark:border-cyan-800 text-sm'>
            <div className='grid grid-cols-1 gap-2'>
              {metadata.dueDate && (
                <div>
                  <span className='text-muted-foreground'>Programado: </span>
                  <span className='font-medium text-cyan-700 dark:text-cyan-300'>
                    {new Date(metadata.dueDate).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {metadata.dueDate && metadata.estimatedHours && (
                <div className='grid grid-cols-2 gap-2'>
                  <div>
                    <span className='text-muted-foreground'>Hora inicio: </span>
                    <span className='font-medium text-cyan-700 dark:text-cyan-300'>
                      {new Date(metadata.dueDate).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Hora fin: </span>
                    <span className='font-medium text-cyan-700 dark:text-cyan-300'>
                      {new Date(
                        new Date(metadata.dueDate).getTime() + metadata.estimatedHours * 3600000
                      ).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )}
              {metadata.estimatedHours && (
                <div>
                  <span className='text-muted-foreground'>Duración: </span>
                  <span className='font-medium'>
                    {(() => {
                      const h = Math.floor(metadata.estimatedHours)
                      const m = Math.round((metadata.estimatedHours - h) * 60)
                      if (h === 0) return `${m} minutos`
                      if (m === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`
                      return `${h} ${h === 1 ? 'hora' : 'horas'} ${m} minutos`
                    })()}
                  </span>
                </div>
              )}
              {metadata.completedAt && (
                <div>
                  <span className='text-muted-foreground'>Completada: </span>
                  <span className='font-medium text-green-700 dark:text-green-300'>
                    {new Date(metadata.completedAt).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              {metadata.assignedTo && (
                <div>
                  <span className='text-muted-foreground'>Asignado a: </span>
                  <span className='font-medium'>{metadata.assignedTo.name}</span>
                </div>
              )}
            </div>
            <div className='flex items-center space-x-2'>
              <Badge variant='outline' className='text-xs'>
                {metadata.priority === 'high'
                  ? 'Alta'
                  : metadata.priority === 'medium'
                    ? 'Media'
                    : 'Baja'}
              </Badge>
              <Badge
                variant={metadata.status === 'completed' ? 'default' : 'secondary'}
                className='text-xs'
              >
                {metadata.status === 'completed'
                  ? 'Completada'
                  : metadata.status === 'in_progress'
                    ? 'En progreso'
                    : 'Pendiente'}
              </Badge>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center gap-2'>
            <MessageSquare className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-semibold'>Historial</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center py-8'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center gap-2'>
            <MessageSquare className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-semibold text-foreground'>Historial</span>
            <span className='text-xs text-muted-foreground'>· Cronología de actividades</span>
          </div>
        </CardHeader>
        <CardContent>
          {/* Formulario de comentario */}
          {needsInProgress && (
            <Alert className='mb-6'>
              <PlayCircle className='h-4 w-4' />
              <AlertDescription>
                Pon el ticket <strong>En progreso</strong> para escribir comentarios y registrar
                actividad en el historial.
              </AlertDescription>
            </Alert>
          )}
          {canWriteComment && (
            <div
              className={`mb-6 p-4 border rounded-lg space-y-3 transition-colors ${
                isInternal
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
                  : 'bg-muted border-border'
              }`}
            >
              <FormDraftBanner
                visible={wasRestored}
                onDismiss={dismissRestoredBanner}
                onDiscard={() => {
                  clearDraft()
                  dismissRestoredBanner()
                  setNewComment('')
                  setIsInternal(false)
                }}
              />
              {isInternal && (
                <div className='flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400'>
                  <Lock className='h-3.5 w-3.5' />
                  <span>El cliente no verá este comentario</span>
                </div>
              )}
              {!isInternal && !canViewInternal && (
                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                  <Globe className='h-3.5 w-3.5' />
                  <span>Tu mensaje será visible para el equipo de soporte</span>
                </div>
              )}
              <Textarea
                placeholder={
                  isInternal
                    ? 'Nota interna para el equipo...'
                    : 'Agregar un comentario o actualización...'
                }
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                rows={3}
                className={
                  isInternal
                    ? 'border-amber-300 dark:border-amber-700 focus-visible:ring-amber-400'
                    : ''
                }
              />

              {/* Selector de archivos */}
              <div className='space-y-2'>
                <div className='flex items-center space-x-2'>
                  <input
                    type='file'
                    id='tl-attachments'
                    multiple
                    onChange={e => {
                      if (e.target.files) setAttachments(Array.from(e.target.files))
                    }}
                    className='hidden'
                  />
                  <label
                    htmlFor='tl-attachments'
                    className='flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground'
                  >
                    <Upload className='h-4 w-4' />
                    <span>Adjuntar archivos</span>
                  </label>
                </div>
                {attachments.length > 0 && (
                  <div className='space-y-1'>
                    {attachments.map((file, i) => (
                      <div
                        key={i}
                        className='flex items-center justify-between p-2 bg-card rounded border'
                      >
                        <div className='flex items-center space-x-2'>
                          <Paperclip className='h-4 w-4 text-muted-foreground' />
                          <span className='text-sm'>{file.name}</span>
                          <span className='text-xs text-muted-foreground'>
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className='flex items-center justify-between'>
                {canViewInternal ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type='button'
                          onClick={() => setIsInternal(v => !v)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all select-none ${
                            isInternal
                              ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300'
                              : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {isInternal ? (
                            <>
                              <Lock className='h-3.5 w-3.5' /> Solo equipo
                            </>
                          ) : (
                            <>
                              <Globe className='h-3.5 w-3.5' /> Público
                            </>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side='top' className='max-w-xs'>
                        <p className='text-xs'>
                          <strong className='flex items-center gap-1'>
                            <Globe className='h-3 w-3' /> Público:
                          </strong>{' '}
                          el cliente lo verá.
                        </p>
                        <p className='text-xs mt-1'>
                          <strong className='flex items-center gap-1'>
                            <Lock className='h-3 w-3' /> Solo equipo:
                          </strong>{' '}
                          el cliente NO lo verá.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <div />
                )}
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || submitting}
                  size='sm'
                >
                  <Send className='h-4 w-4 mr-2' />
                  {submitting ? 'Enviando…' : 'Enviar'}
                </Button>
              </div>
            </div>
          )}

          {/* Lista de eventos */}
          <div className='space-y-1'>
            {events.length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                <FileText className='h-12 w-12 mx-auto mb-4 text-gray-300' />
                <p>No hay actividad registrada para este ticket</p>
              </div>
            ) : (
              (() => {
                // ── Filtrar según visibilidad ───────────────────────────────
                const visible = events.filter(event => canViewInternal || !event.isInternal)

                // ── Colapso: mostrar los últimos 6, el resto bajo "Ver más" ─
                const INITIAL_VISIBLE = 6
                const hiddenCount =
                  visible.length > INITIAL_VISIBLE ? visible.length - INITIAL_VISIBLE : 0
                const displayed =
                  showAll || hiddenCount === 0 ? visible : visible.slice(0, INITIAL_VISIBLE)

                // ── Helper: separador de fecha entre eventos de días distintos ─
                const dayLabel = (dateStr: string) =>
                  new Date(dateStr).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })

                // ── Helper: timestamp con tooltip para eventos recientes ─────
                const TimestampLabel = ({
                  dateStr,
                  className,
                }: {
                  dateStr: string
                  className?: string
                }) => {
                  const diff = Date.now() - new Date(dateStr).getTime()
                  const isRelative = diff < 24 * 60 * 60 * 1000 // < 24 h → relativo
                  const label = formatTimeAgo(dateStr)
                  const exact = formatExactDateTime(dateStr)

                  if (!isRelative) {
                    return <span className={className}>{label}</span>
                  }
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`${className ?? ''} cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2`}
                        >
                          {label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side='top' className='text-xs'>
                        {exact}
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return (
                  <>
                    <TooltipProvider delayDuration={300}>
                      {displayed.map((event, idx) => {
                        // ── Separador de fecha ANTES del evento ─────────────
                        // El listado es newest-first: el evento [idx] es más reciente
                        // que [idx+1]. Mostramos el separador ENCIMA del primer evento
                        // de cada día, comparando con el evento siguiente (más antiguo).
                        const nextEvent = displayed[idx + 1]
                        const showDaySeparatorBefore =
                          idx === 0 || // siempre encabeza el primer grupo
                          (nextEvent && dayLabel(event.createdAt) !== dayLabel(nextEvent.createdAt))

                        const isSystemEvent = ![
                          'comment',
                          'file_uploaded',
                          'resolution_plan',
                          'resolution_task',
                        ].includes(event.type)

                        const eventNode = isSystemEvent ? (
                          // ── Eventos de sistema: compactos, sin burbuja ──────
                          <div
                            key={event.id}
                            className='flex items-start gap-2.5 py-1.5 px-1 group'
                          >
                            <div className='flex flex-col items-center shrink-0 mt-0.5'>
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center ${getEventColor(event.type, event.isInternal)}`}
                              >
                                {getEventIcon(event.type)}
                              </div>
                            </div>
                            <div className='flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5'>
                              <span className='text-sm font-medium text-foreground'>
                                {event.user?.name ?? '—'}
                              </span>
                              <span className='text-xs text-muted-foreground'>
                                {event.user?.role === 'TECHNICIAN'
                                  ? '· Técnico'
                                  : event.user?.role === 'ADMIN'
                                    ? '· Admin'
                                    : ''}
                              </span>
                              <span className='text-sm text-muted-foreground'>{event.title}</span>
                              {(event.type === 'status_change' ||
                                event.type === 'priority_change') &&
                                event.metadata?.oldValue &&
                                event.metadata?.newValue && (
                                  <span className='inline-flex items-center gap-1 ml-0.5'>
                                    {event.type === 'status_change' ? (
                                      <>
                                        <StatusBadge
                                          status={event.metadata.oldValue as any}
                                          size='sm'
                                        />
                                        <span className='text-muted-foreground text-xs'>→</span>
                                        <StatusBadge
                                          status={event.metadata.newValue as any}
                                          size='sm'
                                        />
                                      </>
                                    ) : (
                                      <>
                                        <PriorityBadge
                                          priority={event.metadata.oldValue as any}
                                          size='sm'
                                        />
                                        <span className='text-muted-foreground text-xs'>→</span>
                                        <PriorityBadge
                                          priority={event.metadata.newValue as any}
                                          size='sm'
                                        />
                                      </>
                                    )}
                                  </span>
                                )}
                              <TimestampLabel
                                dateStr={event.createdAt}
                                className='text-xs text-muted-foreground ml-auto shrink-0'
                              />
                            </div>
                          </div>
                        ) : (
                          // ── Comentarios y archivos: burbuja completa ────────
                          <div key={event.id} className='flex space-x-3 py-2'>
                            <div
                              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(event.type, event.isInternal)}`}
                            >
                              {event.type === 'comment' && event.isInternal ? (
                                <Lock className='h-4 w-4' />
                              ) : (
                                getEventIcon(event.type)
                              )}
                            </div>
                            <div className='flex-1 min-w-0'>
                              <div className='flex items-center justify-between flex-wrap gap-1'>
                                <div className='flex items-center space-x-2 flex-wrap gap-1'>
                                  <span className='font-medium text-foreground'>
                                    {event.user?.name ?? '—'}
                                  </span>
                                  <Badge variant='outline' className='text-xs'>
                                    {event.user?.role === 'TECHNICIAN'
                                      ? 'Técnico'
                                      : event.user?.role === 'ADMIN'
                                        ? 'Admin'
                                        : event.user?.role === 'CLIENT'
                                          ? 'Cliente'
                                          : (event.user?.role ?? '')}
                                  </Badge>
                                  {event.isInternal && (
                                    <Badge className='text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700 flex items-center gap-1'>
                                      <Lock className='h-2.5 w-2.5' />
                                      Solo equipo
                                    </Badge>
                                  )}
                                </div>
                                <TimestampLabel
                                  dateStr={event.createdAt}
                                  className='text-sm text-muted-foreground'
                                />
                              </div>
                              <div className='mt-1'>
                                {event.type === 'comment' && event.description && (
                                  <div
                                    className={`mt-1 p-3 rounded-lg text-sm whitespace-pre-wrap ${
                                      event.isInternal
                                        ? 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                                        : 'bg-muted text-foreground'
                                    }`}
                                  >
                                    {event.description}
                                  </div>
                                )}
                                {event.type === 'file_uploaded' && (
                                  <p className='text-sm text-muted-foreground mt-0.5'>
                                    {event.title}
                                  </p>
                                )}
                                {(event.type === 'resolution_plan' ||
                                  event.type === 'resolution_task') && (
                                  <p className='text-sm text-muted-foreground mt-0.5'>
                                    {event.metadata?.taskTitle
                                      ? `${event.title}: "${event.metadata.taskTitle}"`
                                      : event.title}
                                  </p>
                                )}
                                {renderEventMetadata(event)}
                              </div>
                            </div>
                          </div>
                        )

                        return (
                          <React.Fragment key={event.id}>
                            {/* Separador de fecha ENCIMA del primer evento del día */}
                            {showDaySeparatorBefore && (
                              <div className='flex items-center gap-3 py-2 px-1'>
                                <div className='flex-1 h-px bg-border' />
                                <span className='text-xs text-muted-foreground capitalize shrink-0'>
                                  {dayLabel(event.createdAt)}
                                </span>
                                <div className='flex-1 h-px bg-border' />
                              </div>
                            )}
                            {eventNode}
                          </React.Fragment>
                        )
                      })}
                    </TooltipProvider>

                    {/* Botón "Ver actividades anteriores" — abajo, donde están los eventos más viejos */}
                    {hiddenCount > 0 && !showAll && (
                      <button
                        type='button'
                        onClick={() => setShowAll(true)}
                        className='w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors group'
                      >
                        <ChevronDown className='h-3.5 w-3.5 group-hover:text-primary transition-colors' />
                        <span>
                          Ver {hiddenCount} actividad{hiddenCount > 1 ? 'es' : ''} anterior
                          {hiddenCount > 1 ? 'es' : ''}
                        </span>
                        <ChevronDown className='h-3.5 w-3.5 group-hover:text-primary transition-colors' />
                      </button>
                    )}

                    {/* Botón "Colapsar" cuando está expandido y hay muchos eventos */}
                    {showAll && hiddenCount > 0 && (
                      <button
                        type='button'
                        onClick={() => setShowAll(false)}
                        className='w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors group'
                      >
                        <ChevronUp className='h-3.5 w-3.5 group-hover:text-primary transition-colors' />
                        <span>Colapsar historial</span>
                        <ChevronUp className='h-3.5 w-3.5 group-hover:text-primary transition-colors' />
                      </button>
                    )}
                  </>
                )
              })()
            )}
          </div>
        </CardContent>
      </Card>

      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
      />
    </>
  )
}
