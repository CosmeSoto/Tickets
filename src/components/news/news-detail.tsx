'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  X,
  Eye,
  MessageSquare,
  ThumbsUp,
  Heart,
  PartyPopper,
  Surprise,
  Frown,
  Clap,
  Send,
  Calendar,
  Clock,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'

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

interface NewsReaction {
  id: string
  reaction: string
}

interface NewsComment {
  id: string
  content: string
  userId: string
  user: { id: string; name: string; avatar: string | null }
  parentId: string | null
  replies: NewsComment[]
  createdAt: string
  updatedAt: string
}

interface NewsItem {
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
  news_views: Array<{ id: string }>
  news_reactions: Array<{ id: string; reaction: string }>
  news_attachments: Array<{ id: string; filename: string; originalName: string; path: string }>
  news_comments: NewsComment[]
  _count: { news_views: number; news_reactions: number; news_comments: number }
}

const reactions = [
  { emoji: '👍', label: 'Me gusta' },
  { emoji: '❤️', label: 'Me encanta' },
  { emoji: '🎉', label: 'Genial' },
  { emoji: '😮', label: 'Sorpresa' },
  { emoji: '😢', label: 'Triste' },
  { emoji: '👏', label: 'Aplausos' },
]

interface NewsDetailProps {
  news: NewsItem
  isOpen: boolean
  onClose: () => void
}

export function NewsDetail({ news, isOpen, onClose }: NewsDetailProps) {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [userReaction, setUserReaction] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [replyTo, setReplyTo] = useState<NewsComment | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [comments, setComments] = useState<NewsComment[]>(news.news_comments || [])

  useEffect(() => {
    if (isOpen && news) {
      setUserReaction(news.news_reactions?.length > 0 ? news.news_reactions[0].reaction : null)
      setComments(news.news_comments || [])
    }
  }, [isOpen, news])

  const handleReaction = async (emoji: string) => {
    if (!session?.user || !news.allowReactions) return

    try {
      const response = await fetch(`/api/news/${news.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: emoji }),
      })

      if (!response.ok) throw new Error('Error al enviar reacción')
      const data = await response.json()
      setUserReaction(data.reaction)
    } catch (error) {
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
      const response = await fetch(`/api/news/${news.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: comment,
          parentId: replyTo?.id || null,
        }),
      })

      if (!response.ok) throw new Error('Error al enviar comentario')
      const newComment = await response.json()

      if (replyTo) {
        setComments(
          comments.map(c =>
            c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), newComment] } : c
          )
        )
      } else {
        setComments([newComment, ...comments])
      }

      setComment('')
      setReplyTo(null)
      toast({
        title: 'Comentario enviado',
        description: 'Tu comentario se publicó correctamente',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el comentario',
        variant: 'destructive',
      })
    } finally {
      setSubmittingComment(false)
    }
  }

  const timeAgo = formatDistanceToNow(new Date(news.createdAt), {
    addSuffix: true,
    locale: es,
  })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-4xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <div className='flex items-start justify-between'>
            <div className='flex-1 pr-4'>
              <div className='flex items-center gap-2 mb-2'>
                <Badge variant='secondary'>{news.type}</Badge>
                <Badge>{news.priority}</Badge>
                {news.isFeatured && <Badge className='bg-yellow-500'>Destacado</Badge>}
              </div>
              <DialogTitle className='text-2xl'>{news.title}</DialogTitle>
              <div className='mt-2'>
                <div className='flex items-center gap-3'>
                  <Avatar className='h-8 w-8'>
                    <AvatarImage src={news.createdBy?.avatar || ''} />
                    <AvatarFallback>
                      {news.createdBy?.name?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className='font-medium'>{news.createdBy?.name || 'Autor'}</p>
                    <p className='text-sm text-muted-foreground flex items-center gap-1'>
                      <Clock className='h-3 w-3' />
                      {timeAgo}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {news.imageUrl && (
          <div className='mt-4 rounded-lg overflow-hidden'>
            <img src={news.imageUrl} alt={news.title} className='w-full max-h-64 object-cover' />
          </div>
        )}

        <div className='mt-4'>
          <div className='prose max-w-none'>
            <p className='whitespace-pre-wrap'>{news.content}</p>
          </div>
        </div>

        {(news.startDate || news.endDate) && (
          <div className='mt-4 flex items-center gap-4 text-sm text-muted-foreground'>
            {news.startDate && (
              <div className='flex items-center gap-1'>
                <Calendar className='h-4 w-4' />
                <span>Inicio: {new Date(news.startDate).toLocaleDateString('es-EC')}</span>
              </div>
            )}
            {news.endDate && (
              <div className='flex items-center gap-1'>
                <Calendar className='h-4 w-4' />
                <span>Fin: {new Date(news.endDate).toLocaleDateString('es-EC')}</span>
              </div>
            )}
          </div>
        )}

        <div className='mt-6 flex items-center justify-between'>
          <div className='flex items-center gap-4 text-sm text-muted-foreground'>
            <span className='flex items-center gap-1'>
              <Eye className='h-4 w-4' />
              {news._count?.news_views || 0} vistas
            </span>
            {news.allowReactions && (
              <span className='flex items-center gap-1'>
                <Heart className='h-4 w-4' />
                {news._count?.news_reactions || 0} reacciones
              </span>
            )}
            {news.allowComments && (
              <span className='flex items-center gap-1'>
                <MessageSquare className='h-4 w-4' />
                {news._count?.news_comments || 0} comentarios
              </span>
            )}
          </div>
        </div>

        {news.allowReactions && (
          <>
            <Separator className='my-4' />
            <div className='space-y-2'>
              <p className='text-sm font-medium'>¿Qué te pareció?</p>
              <div className='flex gap-2'>
                {reactions.map(({ emoji, label }) => (
                  <Button
                    key={emoji}
                    variant={userReaction === emoji ? 'default' : 'ghost'}
                    size='sm'
                    onClick={() => handleReaction(emoji)}
                    className='text-lg'
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}

        {news.allowComments && (
          <>
            <Separator className='my-6' />
            <div className='space-y-4'>
              <h3 className='font-medium'>Comentarios</h3>

              <div className='space-y-2'>
                {replyTo && (
                  <div className='bg-muted p-3 rounded-lg text-sm'>
                    <p>
                      Respondiendo a <span className='font-medium'>{replyTo.user?.name}</span>
                    </p>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setReplyTo(null)}
                      className='mt-1'
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
                <Textarea
                  placeholder='Escribe un comentario...'
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                />
                <div className='flex justify-end'>
                  <Button
                    onClick={handleComment}
                    disabled={!comment.trim() || submittingComment}
                    className='flex items-center gap-2'
                  >
                    <Send className='h-4 w-4' />
                    {submittingComment ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              </div>

              <div className='space-y-4 mt-6'>
                {comments.map(comment => (
                  <div key={comment.id} className='space-y-3'>
                    <div className='flex gap-3'>
                      <Avatar className='h-8 w-8 flex-shrink-0'>
                        <AvatarImage src={comment.user?.avatar || ''} />
                        <AvatarFallback>
                          {comment.user?.name?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>{comment.user?.name || 'Usuario'}</span>
                          <span className='text-sm text-muted-foreground'>
                            {formatDistanceToNow(new Date(comment.createdAt), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </span>
                        </div>
                        <p className='mt-1'>{comment.content}</p>
                        {!replyTo && (
                          <Button
                            variant='ghost'
                            size='sm'
                            className='mt-1 h-7 text-xs'
                            onClick={() => setReplyTo(comment)}
                          >
                            Responder
                          </Button>
                        )}

                        {(comment.replies?.length || 0) > 0 && (
                          <div className='mt-3 space-y-3 ml-4 border-l-2 pl-4'>
                            {(comment.replies || []).map(reply => (
                              <div key={reply.id} className='flex gap-3'>
                                <Avatar className='h-6 w-6 flex-shrink-0'>
                                  <AvatarImage src={reply.user?.avatar || ''} />
                                  <AvatarFallback>
                                    {reply.user?.name?.charAt(0).toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className='flex-1'>
                                  <div className='flex items-center gap-2'>
                                    <span className='font-medium text-sm'>
                                      {reply.user?.name || 'Usuario'}
                                    </span>
                                    <span className='text-xs text-muted-foreground'>
                                      {formatDistanceToNow(new Date(reply.createdAt), {
                                        addSuffix: true,
                                        locale: es,
                                      })}
                                    </span>
                                  </div>
                                  <p className='mt-1 text-sm'>{reply.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className='text-center text-muted-foreground py-4'>
                    No hay comentarios aún. Sé el primero en comentar.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
