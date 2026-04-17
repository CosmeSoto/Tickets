'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { Button } from './button'
import { Textarea } from './textarea'
import { StatusBadge, PriorityBadge } from './status-badge'
import {
  Clock, User, MessageSquare, Settings, CheckCircle, AlertCircle,
  FileText, Star, Send, Paperclip, Upload, Calendar, Target, Eye, Download,
  Image as ImageIcon, File as FileIcon, Lock, Globe
} from 'lucide-react'
import { useTimeline, type TimelineEvent } from '@/hooks/use-timeline'
import { formatTimeAgo } from '@/hooks/use-ticket-data'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { FilePreviewModal } from '@/components/tickets/file-preview-modal'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AttachmentItem {
  id: string
  name: string
  size: number
  type?: string      // campo del optimista (File.type)
  mimeType?: string  // campo de la API
}

interface TicketTimelineProps {
  ticketId: string
  canAddComments?: boolean
  canViewInternal?: boolean
  refreshKey?: number
  onCommentAdded?: () => void
  onStopPolling?: (stopFn: () => void) => void
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
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm max-w-xs">
      <span className="text-base shrink-0">{fileEmoji(mime)}</span>
      <span className="flex-1 truncate font-medium min-w-0">{file.name}</span>
      <span className="text-muted-foreground text-xs shrink-0">{fmtSize(file.size)}</span>
      {isPending ? (
        <span className="text-xs text-muted-foreground italic shrink-0">subiendo…</span>
      ) : (
        <>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => onPreview(file)}
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Vista previa</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`/api/tickets/${ticketId}/attachments/${file.id}`}
                  download={file.name}
                  className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted shrink-0"
                >
                  <Download className="h-3 w-3" />
                </a>
              </TooltipTrigger>
              <TooltipContent><p>Descargar</p></TooltipContent>
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
}: TicketTimelineProps) {
  const { data: session } = useSession()
  const { events, loading, addComment, loadTimeline, setEvents, stopPolling } = useTimeline(ticketId)

  // Exponer stopPolling al padre para que lo llame antes de eliminar el ticket
  useEffect(() => {
    if (onStopPolling) onStopPolling(stopPolling)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPolling])
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [previewFile, setPreviewFile] = useState<{
    id: string; originalName: string; mimeType: string; size: number; url: string
  } | null>(null)

  // Recargar cuando el padre lo pida (cambio de estado, asignación, etc.)
  useEffect(() => {
    if (refreshKey > 0) loadTimeline(true)
  }, [refreshKey])

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
      metadata: commentAttachments.length > 0 ? {
        attachments: commentAttachments.map((f, i) => ({
          id: `pending-${i}`,
          name: f.name,
          size: f.size,
          type: f.type,
        }))
      } : undefined,
    }
    // Limpiar form inmediatamente para mejor UX
    setNewComment('')
    setIsInternal(false)
    setAttachments([])
    setEvents(prev => [optimisticEvent, ...prev])

    const result = await addComment(commentContent, commentIsInternal, commentAttachments)
    if (result) {
      // Actualizar ID del optimista inmediatamente con el real
      setEvents(prev => prev.map(e =>
        e.id === optimisticId
          ? { ...e, id: result.id, createdAt: result.createdAt }
          : e
      ))
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
      comment: <MessageSquare className="h-4 w-4" />,
      status_change: <Settings className="h-4 w-4" />,
      assignment: <User className="h-4 w-4" />,
      priority_change: <AlertCircle className="h-4 w-4" />,
      resolution: <CheckCircle className="h-4 w-4" />,
      resolution_plan: <FileText className="h-4 w-4" />,
      resolution_task: <CheckCircle className="h-4 w-4" />,
      rating: <Star className="h-4 w-4" />,
      created: <FileText className="h-4 w-4" />,
      file_uploaded: <Paperclip className="h-4 w-4" />,
    }
    return icons[type] ?? <Clock className="h-4 w-4" />
  }

  const getEventColor = (type: TimelineEvent['type'], isInternal?: boolean) => {
    if (type === 'comment' && isInternal) return 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/50'
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
          <div className="flex items-center space-x-2 mt-2">
            <StatusBadge status={metadata.oldValue as any} size="sm" />
            <span className="text-muted-foreground">→</span>
            <StatusBadge status={metadata.newValue as any} size="sm" />
          </div>
        )

      case 'priority_change':
        return (
          <div className="flex items-center space-x-2 mt-2">
            <PriorityBadge priority={metadata.oldValue as any} size="sm" />
            <span className="text-muted-foreground">→</span>
            <PriorityBadge priority={metadata.newValue as any} size="sm" />
          </div>
        )

      case 'comment':
        if (!metadata.attachments?.length) return null
        return (
          <div className="mt-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Archivos adjuntos ({metadata.attachments.length})
            </p>
            <div className="flex flex-wrap gap-2">
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
          <div className="mt-2 flex flex-wrap gap-2">
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
          <div className="flex items-center space-x-1 mt-2">
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                className={`h-4 w-4 ${star <= (metadata.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
              />
            ))}
            <span className="text-sm text-muted-foreground ml-2">({metadata.rating}/5)</span>
          </div>
        )

      case 'resolution_plan':
        return (
          <div className="mt-3 space-y-3 p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800">
            {metadata.planTitle && (
              <div className="flex items-start space-x-2">
                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                <p className="font-semibold text-indigo-900 dark:text-indigo-100">{metadata.planTitle}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {metadata.startDate && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <span className="text-muted-foreground block text-xs">Inicio programado</span>
                    <div className="font-medium text-indigo-700 dark:text-indigo-300">
                      {new Date(metadata.startDate).toLocaleString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                </div>
              )}
              {metadata.targetDate && (
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <span className="text-muted-foreground block text-xs">Fecha objetivo</span>
                    <div className="font-medium text-indigo-700 dark:text-indigo-300">
                      {new Date(metadata.targetDate).toLocaleString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                </div>
              )}
              {metadata.completedDate && (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <div>
                    <span className="text-muted-foreground block text-xs">Completado el</span>
                    <div className="font-medium text-green-700 dark:text-green-300">
                      {new Date(metadata.completedDate).toLocaleString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                </div>
              )}
              {metadata.estimatedHours && (
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <span className="text-muted-foreground block text-xs">Tiempo estimado</span>
                    <div className="font-medium">{metadata.estimatedHours}h</div>
                  </div>
                </div>
              )}
              {metadata.actualHours !== undefined && metadata.actualHours > 0 && (
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <div>
                    <span className="text-muted-foreground block text-xs">Tiempo real</span>
                    <div className="font-medium text-purple-700 dark:text-purple-300">{metadata.actualHours}h</div>
                  </div>
                </div>
              )}
              {metadata.totalTasks !== undefined && (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <span className="text-muted-foreground block text-xs">Progreso de tareas</span>
                    <div className="font-medium">
                      {metadata.completedTasks || 0} de {metadata.totalTasks}
                      {metadata.totalTasks > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({Math.round(((metadata.completedTasks || 0) / metadata.totalTasks) * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {metadata.status && (
              <div className="flex items-center space-x-2 pt-2 border-t border-indigo-200 dark:border-indigo-800">
                <Badge variant={metadata.status === 'completed' ? 'default' : 'outline'} className={`text-xs ${
                  metadata.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : metadata.status === 'active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                }`}>
                  {metadata.status === 'draft' && '📝 Borrador'}
                  {metadata.status === 'active' && '🔄 Activo'}
                  {metadata.status === 'completed' && '✅ Completado'}
                  {metadata.status === 'cancelled' && '❌ Cancelado'}
                </Badge>
              </div>
            )}
          </div>
        )

      case 'resolution_task':
        return (
          <div className="mt-2 space-y-2 p-3 bg-cyan-50 dark:bg-cyan-950 rounded-lg border border-cyan-200 dark:border-cyan-800 text-sm">
            <div className="grid grid-cols-1 gap-2">
              {metadata.dueDate && (
                <div>
                  <span className="text-muted-foreground">Programado: </span>
                  <span className="font-medium text-cyan-700 dark:text-cyan-300">
                    {new Date(metadata.dueDate).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })}
                  </span>
                </div>
              )}
              {metadata.dueDate && metadata.estimatedHours && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Hora inicio: </span>
                    <span className="font-medium text-cyan-700 dark:text-cyan-300">
                      {new Date(metadata.dueDate).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hora fin: </span>
                    <span className="font-medium text-cyan-700 dark:text-cyan-300">
                      {new Date(new Date(metadata.dueDate).getTime() + metadata.estimatedHours * 3600000)
                        .toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                </div>
              )}
              {metadata.estimatedHours && (
                <div>
                  <span className="text-muted-foreground">Duración: </span>
                  <span className="font-medium">
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
                  <span className="text-muted-foreground">Completada: </span>
                  <span className="font-medium text-green-700 dark:text-green-300">
                    {new Date(metadata.completedAt).toLocaleString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </span>
                </div>
              )}
              {metadata.assignedTo && (
                <div>
                  <span className="text-muted-foreground">Asignado a: </span>
                  <span className="font-medium">{metadata.assignedTo.name}</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {metadata.priority === 'high' ? 'Alta' : metadata.priority === 'medium' ? 'Media' : 'Baja'}
              </Badge>
              <Badge variant={metadata.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                {metadata.status === 'completed' ? 'Completada' : metadata.status === 'in_progress' ? 'En progreso' : 'Pendiente'}
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
        <CardHeader className="pb-3"><div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-semibold">Historial</span></div></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Historial</span>
            <span className="text-xs text-muted-foreground">· Cronología de actividades</span>
          </div>
        </CardHeader>
        <CardContent>
          {/* Formulario de comentario */}
          {canAddComments && (
            <div className={`mb-6 p-4 border rounded-lg space-y-3 transition-colors ${
              isInternal
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
                : 'bg-muted border-border'
            }`}>
              {isInternal && (
                <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <Lock className="h-3.5 w-3.5" />
                  <span>El cliente no verá este comentario</span>
                </div>
              )}
              {!isInternal && !canViewInternal && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Tu mensaje será visible para el equipo de soporte</span>
                </div>
              )}
              <Textarea
                placeholder={isInternal ? "Nota interna para el equipo..." : "Agregar un comentario o actualización..."}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                rows={3}
                className={isInternal ? 'border-amber-300 dark:border-amber-700 focus-visible:ring-amber-400' : ''}
              />

              {/* Selector de archivos */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input type="file" id="tl-attachments" multiple onChange={e => {
                    if (e.target.files) setAttachments(Array.from(e.target.files))
                  }} className="hidden" />
                  <label htmlFor="tl-attachments" className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                    <Upload className="h-4 w-4" />
                    <span>Adjuntar archivos</span>
                  </label>
                </div>
                {attachments.length > 0 && (
                  <div className="space-y-1">
                    {attachments.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-card rounded border">
                        <div className="flex items-center space-x-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>×</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                {canViewInternal ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setIsInternal(v => !v)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all select-none ${
                            isInternal
                              ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300'
                              : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {isInternal
                            ? <><Lock className="h-3.5 w-3.5" /> Solo equipo</>
                            : <><Globe className="h-3.5 w-3.5" /> Público</>
                          }
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs"><strong className="flex items-center gap-1"><Globe className="h-3 w-3" /> Público:</strong> el cliente lo verá.</p>
                        <p className="text-xs mt-1"><strong className="flex items-center gap-1"><Lock className="h-3 w-3" /> Solo equipo:</strong> el cliente NO lo verá.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : <div />}
                <Button onClick={handleAddComment} disabled={!newComment.trim() || submitting} size="sm">
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? 'Enviando…' : 'Enviar'}
                </Button>
              </div>
            </div>
          )}

          {/* Lista de eventos */}
          <div className="space-y-4">
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No hay actividad registrada para este ticket</p>
              </div>
            ) : (
              events
                .filter(event => canViewInternal || !event.isInternal)
                .map(event => (
                  <div key={event.id} className="flex space-x-3">
                    {/* Ícono */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(event.type, event.isInternal)}`}>
                      {event.type === 'comment' && event.isInternal
                        ? <Lock className="h-4 w-4" />
                        : getEventIcon(event.type)
                      }
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-1">
                          <span className="font-medium text-foreground">{event.user.name}</span>
                          <Badge variant="outline" className="text-xs">{
                            event.user.role === 'TECHNICIAN' ? 'Técnico'
                            : event.user.role === 'ADMIN' ? 'Admin'
                            : event.user.role === 'CLIENT' ? 'Cliente'
                            : event.user.role
                          }</Badge>
                          {event.isInternal && (
                            <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700 flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5" />
                              Solo equipo
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">{formatTimeAgo(event.createdAt)}</span>
                      </div>

                      <div className="mt-1">
                        <p className="text-sm font-medium text-foreground">{event.title}</p>

                        {/* Contenido del comentario */}
                        {event.type === 'comment' && event.description && (
                          <div className={`mt-2 p-3 rounded-lg text-sm whitespace-pre-wrap ${
                            event.isInternal
                              ? 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                              : 'bg-muted text-foreground'
                          }`}>
                            {event.description}
                          </div>
                        )}

                        {/* Descripción para otros eventos */}
                        {event.type !== 'comment' && event.description && !(event.type === 'resolution_plan' && event.metadata) && event.type !== 'file_uploaded' && (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{event.description}</p>
                        )}

                        {renderEventMetadata(event)}
                      </div>
                    </div>
                  </div>
                ))
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
