'use client'

import { useState } from 'react'
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
  Upload
} from 'lucide-react'
import { useTimeline, type TimelineEvent } from '@/hooks/use-timeline'
import { formatTimeAgo } from '@/hooks/use-ticket-data'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

interface TicketTimelineProps {
  ticketId: string
  canAddComments?: boolean
  canViewInternal?: boolean
}

export function TicketTimeline({ 
  ticketId, 
  canAddComments = false, 
  canViewInternal = false 
}: TicketTimelineProps) {
  const { events, loading, addComment } = useTimeline(ticketId)
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    setSubmitting(true)
    const success = await addComment(newComment, isInternal, attachments)
    
    if (success) {
      setNewComment('')
      setIsInternal(false)
      setAttachments([])
    }
    setSubmitting(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files))
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'comment':
        return <MessageSquare className="h-4 w-4" />
      case 'status_change':
        return <Settings className="h-4 w-4" />
      case 'assignment':
        return <User className="h-4 w-4" />
      case 'priority_change':
        return <AlertCircle className="h-4 w-4" />
      case 'resolution':
        return <CheckCircle className="h-4 w-4" />
      case 'rating':
        return <Star className="h-4 w-4" />
      case 'created':
        return <FileText className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'comment':
        return 'text-blue-600 bg-blue-100'
      case 'status_change':
        return 'text-purple-600 bg-purple-100'
      case 'assignment':
        return 'text-green-600 bg-green-100'
      case 'priority_change':
        return 'text-orange-600 bg-orange-100'
      case 'resolution':
        return 'text-emerald-600 bg-emerald-100'
      case 'rating':
        return 'text-yellow-600 bg-yellow-100'
      case 'created':
        return 'text-muted-foreground bg-muted'
      default:
        return 'text-muted-foreground bg-muted'
    }
  }

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
      
      case 'rating':
        return (
          <div className="flex items-center space-x-1 mt-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  star <= (metadata.rating || 0)
                    ? 'text-yellow-400 fill-current'
                    : 'text-gray-300'
                }`}
              />
            ))}
            <span className="text-sm text-muted-foreground ml-2">
              ({metadata.rating}/5)
            </span>
          </div>
        )
      
      case 'comment':
        if (metadata.attachments && metadata.attachments.length > 0) {
          return (
            <div className="mt-2">
              <div className="text-sm text-muted-foreground mb-1">Archivos adjuntos:</div>
              {metadata.attachments.map((file) => (
                <div key={file.id} className="flex items-center space-x-2 text-sm">
                  <Paperclip className="h-3 w-3" />
                  <span>{file.name}</span>
                  <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                  {file.url && (
                    <a 
                      href={file.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Descargar
                    </a>
                  )}
                </div>
              ))}
            </div>
          )
        }
        return null
      
      default:
        return null
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historial del Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial del Ticket</CardTitle>
        <CardDescription>
          Cronología completa de actividades y cambios
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Formulario para agregar comentarios */}
        {canAddComments && (
          <div className="mb-6 p-4 border rounded-lg bg-muted">
            <div className="space-y-3">
              <Textarea
                placeholder="Agregar un comentario o actualización..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
              
              {/* Archivos adjuntos */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    id="attachments"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label
                          htmlFor="attachments"
                          className="flex items-center space-x-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                        >
                          <Upload className="h-4 w-4" />
                          <span>Adjuntar archivos</span>
                        </label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Adjunta capturas de pantalla, logs o documentos relevantes</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                {attachments.length > 0 && (
                  <div className="space-y-1">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-card rounded border">
                        <div className="flex items-center space-x-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="internal"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor="internal" className="text-sm text-muted-foreground cursor-pointer">
                          Comentario interno (solo visible para el equipo)
                        </label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Los comentarios internos solo son visibles para técnicos y administradores</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={handleAddComment} 
                        disabled={!newComment.trim() || submitting}
                        size="sm"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {submitting ? 'Enviando...' : 'Enviar'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Agrega este comentario al historial del ticket</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        )}

        {/* Timeline de eventos */}
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay actividad registrada para este ticket</p>
            </div>
          ) : (
            events
              .filter(event => canViewInternal || !event.isInternal)
              .map((event) => (
                <div key={event.id} className="flex space-x-3">
                  {/* Icono del evento */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(event.type)}`}>
                    {getEventIcon(event.type)}
                  </div>
                  
                  {/* Contenido del evento */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-foreground">
                          {event.user.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {event.user.role}
                        </Badge>
                        {event.isInternal && (
                          <Badge variant="secondary" className="text-xs">
                            Interno
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatTimeAgo(event.createdAt)}
                      </span>
                    </div>
                    
                    <div className="mt-1">
                      <p className="text-sm font-medium text-foreground">
                        {event.title}
                      </p>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                          {event.description}
                        </p>
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
  )
}