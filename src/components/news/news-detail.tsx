'use client'

/**
 * NewsDetail — componente unificado para ver el detalle de una noticia.
 *
 * Modos:
 *  - 'view'   : feed de usuarios (reacciones + comentarios, sin edición)
 *  - 'manage' : gestión admin/gestor (acciones editar/eliminar + reacciones/comentarios en tabs)
 */

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Eye,
  MessageSquare,
  Heart,
  Send,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  EyeOff,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

type NewsType =
  | 'NEWS'
  | 'ANNOUNCEMENT'
  | 'EVENT'
  | 'BIRTHDAY'
  | 'HOLIDAY'
  | 'ALERT'
  | 'INTERNAL_AD'
  | 'RECOGNITION'
type NewsPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
type NewsStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

interface ReactionWithUser {
  id: string
  reaction: string
  user: { id: string; name: string; avatar: string | null }
}

export interface NewsComment {
  id: string
  content: string
  userId: string
  isHidden?: boolean
  user: { id: string; name: string; avatar: string | null }
  parentId: string | null
  replies: NewsComment[]
  createdAt: string
  updatedAt: string
}

export interface NewsDetailItem {
  id: string
  title: string
  slug: string
  content: string
  summary: string | null
  imageUrl: string | null
  type: NewsType
  priority: NewsPriority
  status: NewsStatus
  startDate: string | null
  endDate: string | null
  isFeatured: boolean
  allowComments: boolean
  allowReactions: boolean
  views: number
  createdById: string
  updatedById: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string; email: string; avatar: string | null }
  news_views?: Array<{ id: string }>
  news_reactions?: Array<{ id: string; reaction: string }>
  news_attachments?: Array<{ id: string; filename: string; originalName: string; path: string }>
  news_comments?: NewsComment[]
  _count: { news_views: number; news_reactions: number; news_comments: number }
}

const REACTIONS = [
  { emoji: '👍', label: 'Me gusta' },
  { emoji: '❤️', label: 'Me encanta' },
  { emoji: '🎉', label: 'Genial' },
  { emoji: '😮', label: 'Sorpresa' },
  { emoji: '😢', label: 'Triste' },
  { emoji: '👏', label: 'Aplausos' },
]

const TYPE_LABELS: Record<NewsType, string> = {
  NEWS: 'Noticia',
  ANNOUNCEMENT: 'Comunicado',
  EVENT: 'Evento',
  BIRTHDAY: 'Cumpleaños',
  HOLIDAY: 'Festividad',
  ALERT: 'Alerta',
  INTERNAL_AD: 'Publicidad',
  RECOGNITION: 'Reconocimiento',
}

const PRIORITY_COLORS: Record<NewsPriority, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

const PRIORITY_LABELS: Record<NewsPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface NewsDetailProps {
  news: NewsDetailItem
  isOpen: boolean
  onClose: () => void
  /** 'view' = solo lectura con reacciones/comentarios | 'manage' = con acciones editar/eliminar */
  mode?: 'view' | 'manage'
  onEdit?: (news: NewsDetailItem) => void
  onDelete?: (news: NewsDetailItem) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NewsDetail({
  news,
  isOpen,
  onClose,
  mode = 'view',
  onEdit,
  onDelete,
}: NewsDetailProps) {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [userReaction, setUserReaction] = useState<string | null>(null)
  const [allReactions, setAllReactions] = useState<ReactionWithUser[]>([])
  const [showReactionsList, setShowReactionsList] = useState(false)
  const [comment, setComment] = useState('')
  const [replyTo, setReplyTo] = useState<NewsComment | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [comments, setComments] = useState<NewsComment[]>([])
  const initializedRef = useRef<string | null>(null)

  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const isOwner = news.createdBy?.id === session?.user?.id
  const canManage = isSuperAdmin || isOwner

  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = null
      return
    }
    // Solo inicializar una vez por noticia abierta
    if (initializedRef.current === news.id) return
    initializedRef.current = news.id

    setCurrentImageIndex(0)
    setUserReaction(news.news_reactions?.length ? news.news_reactions[0].reaction : null)
    setComments(news.news_comments || [])
    setShowReactionsList(false)
    setComment('')
    setReplyTo(null)

    // Cargar reacciones con info de usuario
    if (news.allowReactions) {
      fetch(`/api/news/${news.id}/reactions`)
        .then(r => (r.ok ? r.json() : { reactions: [] }))
        .then(d => setAllReactions(d.reactions || []))
        .catch(() => {})
    }

    // Si no vienen comentarios en el prop, cargarlos desde la API
    if (!news.news_comments || news.news_comments.length === 0) {
      fetch(`/api/news/${news.id}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (d?.news?.news_comments) setComments(d.news.news_comments)
        })
        .catch(() => {})
    }
  }, [isOpen, news.id])

  // Agrupar reacciones por emoji
  const reactionGroups = REACTIONS.map(r => ({
    ...r,
    users: allReactions.filter(ar => ar.reaction === r.emoji).map(ar => ar.user),
    count: allReactions.filter(ar => ar.reaction === r.emoji).length,
  })).filter(g => g.count > 0)

  const handleReaction = async (emoji: string) => {
    if (!session?.user || !news.allowReactions) return
    const prev = userReaction
    const isToggle = userReaction === emoji
    setUserReaction(isToggle ? null : emoji)
    setAllReactions(prev => {
      const filtered = prev.filter(r => r.user.id !== session.user.id)
      if (!isToggle)
        return [
          ...filtered,
          {
            id: 'temp',
            reaction: emoji,
            user: {
              id: session.user.id,
              name: session.user.name || '',
              avatar: (session.user as any).avatar || null,
            },
          },
        ]
      return filtered
    })
    try {
      const res = await fetch(`/api/news/${news.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: emoji }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUserReaction(data.reaction)
      fetch(`/api/news/${news.id}/reactions`)
        .then(r => (r.ok ? r.json() : { reactions: [] }))
        .then(d => setAllReactions(d.reactions || []))
        .catch(() => {})
    } catch {
      setUserReaction(prev)
      toast({
        title: 'Error',
        description: 'No se pudo enviar la reacción',
        variant: 'destructive',
      })
    }
  }

  const handleComment = async () => {
    if (!session?.user || !news.allowComments || !comment.trim()) return
    try {
      setSubmittingComment(true)
      const res = await fetch(`/api/news/${news.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: comment, parentId: replyTo?.id || null }),
      })
      if (!res.ok) throw new Error()
      const newComment = await res.json()
      if (replyTo) {
        setComments(cs =>
          cs.map(c =>
            c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), newComment] } : c
          )
        )
      } else {
        setComments(cs => [newComment, ...cs])
      }
      setComment('')
      setReplyTo(null)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el comentario',
        variant: 'destructive',
      })
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleHideComment = async (commentId: string, hidden: boolean) => {
    try {
      const res = await fetch(`/api/news/${news.id}/comment/${commentId}/hide`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden: hidden }),
      })
      if (!res.ok) throw new Error()
      setComments(cs => cs.map(c => (c.id === commentId ? { ...c, isHidden: hidden } : c)))
      toast({ title: hidden ? 'Comentario ocultado' : 'Comentario visible' })
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el comentario',
        variant: 'destructive',
      })
    }
  }

  const timeAgo = formatDistanceToNow(new Date(news.createdAt), { addSuffix: true, locale: es })
  const visibleComments = comments.filter(c => !c.isHidden || canManage)

  // ── Render ────────────────────────────────────────────────────────────────

  const reactionsContent = (
    <>
      {/* Contadores */}
      <div className='flex items-center gap-4 text-xs text-muted-foreground'>
        <span className='flex items-center gap-1'>
          <Eye className='h-3.5 w-3.5' />
          {news._count?.news_views || 0} vistas
        </span>
        {news.allowReactions && (
          <button
            className='flex items-center gap-1 hover:text-foreground transition-colors'
            onClick={() => setShowReactionsList(v => !v)}
          >
            <Heart className='h-3.5 w-3.5' />
            {allReactions.length} reacciones
            {showReactionsList ? (
              <ChevronUp className='h-3 w-3' />
            ) : (
              <ChevronDown className='h-3 w-3' />
            )}
          </button>
        )}
        {news.allowComments && (
          <span className='flex items-center gap-1'>
            <MessageSquare className='h-3.5 w-3.5' />
            {visibleComments.length} comentarios
          </span>
        )}
      </div>

      {/* Panel expandible de quién reaccionó */}
      {news.allowReactions && showReactionsList && (
        <div className='rounded-lg border bg-muted/30 p-3 space-y-2'>
          {reactionGroups.length === 0 ? (
            <p className='text-xs text-muted-foreground text-center'>Sin reacciones aún</p>
          ) : (
            reactionGroups.map(group => (
              <div key={group.emoji} className='flex items-center gap-2'>
                <span className='text-base w-6'>{group.emoji}</span>
                <div className='flex flex-wrap gap-1 flex-1'>
                  {group.users.map(u => (
                    <TooltipProvider key={u.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className='h-6 w-6 cursor-default'>
                            <AvatarImage src={u.avatar || ''} />
                            <AvatarFallback className='text-[10px]'>
                              {u.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent side='top'>
                          <p className='text-xs'>{u.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
                <span className='text-xs text-muted-foreground'>{group.count}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Botones de reacción */}
      {news.allowReactions && (
        <>
          <Separator />
          <div className='space-y-2'>
            <p className='text-xs font-medium text-muted-foreground'>¿Qué te pareció?</p>
            <div className='flex gap-1 flex-wrap'>
              {REACTIONS.map(({ emoji, label }) => {
                const count = allReactions.filter(r => r.reaction === emoji).length
                const isSelected = userReaction === emoji
                return (
                  <TooltipProvider key={emoji}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isSelected ? 'default' : 'outline'}
                          size='sm'
                          onClick={() => handleReaction(emoji)}
                          className='gap-1 h-8 px-2.5'
                        >
                          <span className='text-base'>{emoji}</span>
                          {count > 0 && <span className='text-xs font-medium'>{count}</span>}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side='top'>
                        <p className='text-xs'>{label}</p>
                        {count > 0 && (
                          <p className='text-xs text-muted-foreground'>
                            {allReactions
                              .filter(r => r.reaction === emoji)
                              .slice(0, 5)
                              .map(r => r.user.name)
                              .join(', ')}
                            {count > 5 && ' y más...'}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )

  const commentsContent = (
    <div className='space-y-4'>
      {news.allowComments && (
        <div className='space-y-2'>
          {replyTo && (
            <div className='bg-muted/50 border-l-2 border-primary px-3 py-2 rounded-r-lg text-xs flex items-center justify-between'>
              <span>
                Respondiendo a <span className='font-medium'>{replyTo.user?.name}</span>
              </span>
              <Button
                variant='ghost'
                size='sm'
                className='h-5 px-1 text-xs'
                onClick={() => setReplyTo(null)}
              >
                ✕
              </Button>
            </div>
          )}
          <div className='flex gap-2'>
            <Avatar className='h-7 w-7 flex-shrink-0 mt-1'>
              <AvatarImage src={(session?.user as any)?.avatar || ''} />
              <AvatarFallback className='text-xs'>
                {session?.user?.name?.charAt(0).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className='flex-1 space-y-1.5'>
              <Textarea
                placeholder='Escribe un comentario...'
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
                className='text-sm resize-none'
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleComment()
                }}
              />
              <div className='flex justify-between items-center'>
                <span className='text-xs text-muted-foreground'>Ctrl+Enter para enviar</span>
                <Button
                  size='sm'
                  onClick={handleComment}
                  disabled={!comment.trim() || submittingComment}
                  className='h-7 gap-1.5'
                >
                  <Send className='h-3.5 w-3.5' />
                  {submittingComment ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className='space-y-3'>
        {visibleComments.map(c => (
          <CommentItem
            key={c.id}
            comment={c}
            currentUserId={session?.user?.id}
            canManage={canManage}
            onReply={setReplyTo}
            onHide={handleHideComment}
          />
        ))}
        {visibleComments.length === 0 && (
          <p className='text-center text-xs text-muted-foreground py-6'>
            No hay comentarios aún. Sé el primero en comentar.
          </p>
        )}
      </div>
    </div>
  )

  // Estado para el carousel
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Obtener todas las imágenes (attachments + imageUrl)
  const getAllImages = () => {
    const images: string[] = []
    // Primero las attachments
    if (news.news_attachments?.length) {
      news.news_attachments.forEach((a: any) => {
        images.push(`/api/news/${news.id}/attachments/${a.id}/file`)
      })
    }
    // Luego la imageUrl si existe y no está ya en las attachments
    if (news.imageUrl && !images.includes(news.imageUrl)) {
      images.unshift(news.imageUrl)
    }
    return images
  }

  const allImages = getAllImages()

  const newsBodyContent = (
    <div className='space-y-4'>
      {allImages.length > 0 && (
        <div className='rounded-lg overflow-hidden bg-muted/30'>
          {allImages.length === 1 ? (
            // Single image
            <img src={allImages[0]} alt={news.title} className='w-full h-auto object-contain' />
          ) : (
            // Carousel
            <div className='relative'>
              <img
                src={allImages[currentImageIndex]}
                alt={`${news.title} - Imagen ${currentImageIndex + 1}`}
                className='w-full h-auto object-contain max-h-[400px]'
              />
              {/* Previous button */}
              <button
                type='button'
                onClick={() =>
                  setCurrentImageIndex(prev => (prev - 1 + allImages.length) % allImages.length)
                }
                className='absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full'
              >
                ←
              </button>
              {/* Next button */}
              <button
                type='button'
                onClick={() => setCurrentImageIndex(prev => (prev + 1) % allImages.length)}
                className='absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full'
              >
                →
              </button>
              {/* Indicators */}
              <div className='absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1'>
                {allImages.map((_, index) => (
                  <button
                    key={index}
                    type='button'
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-2 h-2 rounded-full ${
                      index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className='text-sm whitespace-pre-wrap leading-relaxed'>{news.content}</div>
      {(news.startDate || news.endDate) && (
        <div className='flex items-center gap-4 text-xs text-muted-foreground'>
          {news.startDate && (
            <span className='flex items-center gap-1'>
              <Calendar className='h-3 w-3' />
              Inicio: {new Date(news.startDate).toLocaleDateString('es-EC')}
            </span>
          )}
          {news.endDate && (
            <span className='flex items-center gap-1'>
              <Calendar className='h-3 w-3' />
              Fin: {new Date(news.endDate).toLocaleDateString('es-EC')}
            </span>
          )}
        </div>
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2 mb-1 flex-wrap'>
                <Badge variant='secondary'>{TYPE_LABELS[news.type] || news.type}</Badge>
                <Badge className={PRIORITY_COLORS[news.priority]}>
                  {PRIORITY_LABELS[news.priority] || news.priority}
                </Badge>
                {news.isFeatured && (
                  <Badge className='bg-yellow-500 text-white'>⭐ Destacado</Badge>
                )}
                {news.status !== 'PUBLISHED' && (
                  <Badge variant='outline' className='text-muted-foreground'>
                    {news.status === 'DRAFT' ? 'Borrador' : 'Archivado'}
                  </Badge>
                )}
              </div>
              <DialogTitle className='text-xl leading-snug break-words overflow-hidden'>
                {news.title}
              </DialogTitle>
              <div className='flex items-center gap-3 mt-2'>
                <Avatar className='h-7 w-7'>
                  <AvatarImage src={news.createdBy?.avatar || ''} />
                  <AvatarFallback className='text-xs'>
                    {news.createdBy?.name?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className='text-sm font-medium'>{news.createdBy?.name || 'Autor'}</p>
                  <p className='text-xs text-muted-foreground flex items-center gap-1'>
                    <Clock className='h-3 w-3' />
                    {timeAgo}
                  </p>
                </div>
              </div>
            </div>
            {/* Acciones de gestión */}
            {mode === 'manage' && canManage && (
              <div className='flex gap-1 flex-shrink-0'>
                {onEdit && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      onClose()
                      onEdit(news)
                    }}
                    className='gap-1.5'
                  >
                    <Edit className='h-3.5 w-3.5' />
                    Editar
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      onClose()
                      onDelete(news)
                    }}
                    className='gap-1.5 text-destructive hover:text-destructive'
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                    Eliminar
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Modo view: contenido + reacciones + comentarios en flujo lineal */}
        {mode === 'view' && (
          <div className='space-y-4'>
            {newsBodyContent}
            {reactionsContent}
            {news.allowComments && (
              <>
                <Separator />
                <h3 className='text-sm font-semibold'>Comentarios</h3>
                {commentsContent}
              </>
            )}
          </div>
        )}

        {/* Modo manage: tabs para separar contenido de interacciones */}
        {mode === 'manage' && (
          <Tabs defaultValue='content'>
            <TabsList className='w-full grid grid-cols-2'>
              <TabsTrigger value='content'>Contenido</TabsTrigger>
              <TabsTrigger value='interactions'>
                Interacciones
                {(allReactions.length > 0 || visibleComments.length > 0) && (
                  <span className='ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5'>
                    {allReactions.length + visibleComments.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value='content' className='space-y-4 mt-4'>
              {newsBodyContent}
            </TabsContent>
            <TabsContent value='interactions' className='space-y-4 mt-4'>
              {reactionsContent}
              {news.allowComments && (
                <>
                  <Separator />
                  <h3 className='text-sm font-semibold'>Comentarios</h3>
                  {commentsContent}
                </>
              )}
              {!news.allowReactions && !news.allowComments && (
                <p className='text-center text-xs text-muted-foreground py-6'>
                  Las interacciones están deshabilitadas para esta noticia.
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── CommentItem ───────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  currentUserId,
  canManage,
  onReply,
  onHide,
  isReply = false,
}: {
  comment: NewsComment
  currentUserId?: string
  canManage: boolean
  onReply: (c: NewsComment) => void
  onHide: (id: string, hidden: boolean) => void
  isReply?: boolean
}) {
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: es })
  const isOwn = comment.user?.id === currentUserId

  return (
    <div
      className={`flex gap-2.5 ${isReply ? 'ml-8' : ''} ${comment.isHidden ? 'opacity-50' : ''}`}
    >
      <Avatar className='h-7 w-7 flex-shrink-0 mt-0.5'>
        <AvatarImage src={comment.user?.avatar || ''} />
        <AvatarFallback className='text-xs'>
          {comment.user?.name?.charAt(0).toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
      <div className='flex-1 min-w-0'>
        <div
          className={`rounded-2xl px-3 py-2 inline-block max-w-full ${isOwn ? 'bg-primary/10' : 'bg-muted/60'}`}
        >
          <div className='flex items-baseline gap-2 mb-0.5'>
            <span className='text-xs font-semibold'>{comment.user?.name || 'Usuario'}</span>
            {isOwn && <span className='text-[10px] text-muted-foreground'>Tú</span>}
            {comment.isHidden && <span className='text-[10px] text-orange-500'>Oculto</span>}
          </div>
          <p className='text-sm break-words'>{comment.content}</p>
        </div>
        <div className='flex items-center gap-3 mt-1 ml-1'>
          <span className='text-[10px] text-muted-foreground'>{timeAgo}</span>
          {!isReply && !comment.isHidden && (
            <button
              className='text-[10px] text-muted-foreground hover:text-foreground font-medium transition-colors'
              onClick={() => onReply(comment)}
            >
              Responder
            </button>
          )}
          {canManage && (
            <button
              className='text-[10px] text-muted-foreground hover:text-orange-500 transition-colors flex items-center gap-0.5'
              onClick={() => onHide(comment.id, !comment.isHidden)}
            >
              <EyeOff className='h-3 w-3' />
              {comment.isHidden ? 'Mostrar' : 'Ocultar'}
            </button>
          )}
        </div>
        {(comment.replies?.length || 0) > 0 && (
          <div className='mt-2 space-y-2'>
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                canManage={canManage}
                onReply={onReply}
                onHide={onHide}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
