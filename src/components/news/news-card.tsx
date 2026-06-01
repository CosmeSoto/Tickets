'use client'

import {
  Newspaper,
  Calendar,
  AlertTriangle,
  Gift,
  PartyPopper,
  Megaphone,
  Star,
  TrendingUp,
  Eye,
  MessageSquare,
  ThumbsUp,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { detectMedia } from '@/components/common/media-url-input'

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
  news_attachments?: Array<{
    id: string
    filename: string
    originalName: string
    path: string
  }>
  _count: { news_views: number; news_reactions: number; news_comments: number }
}

const typeIcons: Record<NewsType, React.ReactNode> = {
  NEWS: <Newspaper className='h-4 w-4' />,
  ANNOUNCEMENT: <Megaphone className='h-4 w-4' />,
  EVENT: <Calendar className='h-4 w-4' />,
  BIRTHDAY: <Gift className='h-4 w-4' />,
  HOLIDAY: <PartyPopper className='h-4 w-4' />,
  ALERT: <AlertTriangle className='h-4 w-4' />,
  INTERNAL_AD: <TrendingUp className='h-4 w-4' />,
  RECOGNITION: <Star className='h-4 w-4' />,
}

const typeLabels: Record<NewsType, string> = {
  NEWS: 'Noticia',
  ANNOUNCEMENT: 'Comunicado',
  EVENT: 'Evento',
  BIRTHDAY: 'Cumpleaños',
  HOLIDAY: 'Festividad',
  ALERT: 'Alerta',
  INTERNAL_AD: 'Publicidad',
  RECOGNITION: 'Reconocimiento',
}

const priorityLabels: Record<NewsPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const priorityColors: Record<NewsPriority, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
}

interface NewsCardProps {
  news: NewsItem
  onClick: () => void
  isFeatured?: boolean
  isUrgent?: boolean
  isViewed?: boolean
  className?: string
}

export function NewsCard({
  news,
  onClick,
  isFeatured,
  isUrgent,
  isViewed,
  className,
}: NewsCardProps) {
  const timeAgo = formatDistanceToNow(new Date(news.createdAt), {
    addSuffix: true,
    locale: es,
  })

  // Obtener thumbnail: usa detectMedia para soportar Google Drive, OneDrive, YouTube, etc.
  // Solo mostramos thumbnail si es una imagen directa (no iframe — no cabe en 80x80)
  const getThumbnail = (): { src: string; isImage: boolean } | null => {
    if (!news.imageUrl) return null
    const media = detectMedia(news.imageUrl)
    if (media.type === 'image' && media.embedUrl) {
      return { src: media.embedUrl, isImage: true }
    }
    // Para YouTube: usar thumbnail de alta calidad
    if (media.type === 'youtube' && news.imageUrl) {
      const ytMatch = news.imageUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
      if (ytMatch) {
        return { src: `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`, isImage: true }
      }
    }
    // Para Google Drive con imagen: usar thumbnail de Drive
    if (media.type === 'google-drive') {
      const gdMatch = news.imageUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/)
      if (gdMatch) {
        return { src: `https://drive.google.com/thumbnail?id=${gdMatch[1]}&sz=w200`, isImage: true }
      }
    }
    return null
  }

  const thumbnail = getThumbnail()

  // Icono de tipo de media para cuando no hay thumbnail
  const getMediaIcon = () => {
    if (!news.imageUrl) return null
    const media = detectMedia(news.imageUrl)
    const icons: Record<string, string> = {
      youtube: '▶️',
      'google-drive': '📁',
      onedrive: '☁️',
      dropbox: '📦',
      pdf: '📕',
      office: '📄',
    }
    return icons[media.type] || null
  }

  const mediaIcon = !thumbnail ? getMediaIcon() : null

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md py-0',
        isViewed && 'opacity-70',
        isUrgent && 'border-red-500 border',
        isFeatured && 'border-yellow-500 border',
        className
      )}
      onClick={onClick}
    >
      <CardContent className='p-4'>
        <div className='flex items-start gap-4'>
          {/* Thumbnail: imagen directa, YouTube, Google Drive, o icono de tipo */}
          {(thumbnail || mediaIcon) && (
            <div className='w-20 h-20 rounded-md overflow-hidden flex-shrink-0 bg-muted/30 flex items-center justify-center'>
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnail.src}
                  alt={news.title}
                  className='w-full h-full object-cover'
                  onError={e => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <span className='text-3xl'>{mediaIcon}</span>
              )}
            </div>
          )}

          {/* Contenido */}
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-1.5 mb-1 flex-wrap'>
              <Badge variant='secondary' className='text-[10px] px-1.5 py-0 h-5 gap-0.5'>
                {typeIcons[news.type]}
                {typeLabels[news.type]}
              </Badge>
              <Badge className={cn(priorityColors[news.priority], 'text-[10px] px-1.5 py-0 h-5')}>
                {priorityLabels[news.priority]}
              </Badge>
              {isFeatured && (
                <Badge className='bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0 h-5'>
                  ⭐ Destacado
                </Badge>
              )}
              {isUrgent && (
                <Badge className='bg-red-100 text-red-800 text-[10px] px-1.5 py-0 h-5'>
                  ⚠ Urgente
                </Badge>
              )}
              {!isViewed && (
                <Badge className='bg-blue-500 text-white text-[10px] px-1.5 py-0 h-5'>Nuevo</Badge>
              )}
            </div>

            <h4 className='font-semibold text-sm line-clamp-2 break-words overflow-hidden'>
              {news.title}
            </h4>
            {news.summary && (
              <p className='text-xs text-muted-foreground line-clamp-2 mt-0.5 break-words overflow-hidden'>
                {news.summary}
              </p>
            )}

            {/* Footer: autor + stats */}
            <div className='flex items-center justify-between mt-2 flex-wrap gap-2'>
              <div className='flex items-center gap-2 min-w-0'>
                <Avatar className='h-5 w-5 flex-shrink-0'>
                  <AvatarImage src={news.createdBy.avatar || ''} />
                  <AvatarFallback className='text-[9px]'>
                    {news.createdBy.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className='text-xs text-muted-foreground truncate'>
                  {news.createdBy.name}
                </span>
                <span className='text-[10px] text-muted-foreground flex-shrink-0'>· {timeAgo}</span>
              </div>
              <div className='flex items-center gap-2 text-[10px] text-muted-foreground flex-shrink-0'>
                <span className='flex items-center gap-0.5'>
                  <Eye className='h-3 w-3' />
                  {news._count.news_views}
                </span>
                {news.allowReactions && (
                  <span className='flex items-center gap-0.5'>
                    <ThumbsUp className='h-3 w-3' />
                    {news._count.news_reactions}
                  </span>
                )}
                {news.allowComments && (
                  <span className='flex items-center gap-0.5'>
                    <MessageSquare className='h-3 w-3' />
                    {news._count.news_comments}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
