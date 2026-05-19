'use client'

import {
  Newspaper,
  Calendar,
  Users,
  AlertTriangle,
  Gift,
  PartyPopper,
  Megaphone,
  Star,
  TrendingUp,
  Eye,
  MessageSquare,
  ThumbsUp,
  Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

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

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isViewed && 'opacity-70',
        isUrgent && 'border-red-500 border-2',
        isFeatured && 'border-yellow-500 border-2',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex-1'>
            <div className='flex items-center gap-2 mb-2 flex-wrap'>
              <Badge variant='secondary' className='flex items-center gap-1'>
                {typeIcons[news.type]}
                {typeLabels[news.type]}
              </Badge>
              <Badge className={priorityColors[news.priority]}>
                {priorityLabels[news.priority]}
              </Badge>
              {isFeatured && (
                <Badge className='bg-yellow-100 text-yellow-800 flex items-center gap-1'>
                  <Star className='h-3 w-3' />
                  Destacado
                </Badge>
              )}
              {isUrgent && (
                <Badge className='bg-red-100 text-red-800 flex items-center gap-1'>
                  <AlertTriangle className='h-3 w-3' />
                  Urgente
                </Badge>
              )}
              {!isViewed && <Badge className='bg-blue-500 text-white'>Nuevo</Badge>}
            </div>
            <CardTitle className='text-lg line-clamp-2'>{news.title}</CardTitle>
            {news.summary && (
              <CardDescription className='line-clamp-2 mt-1'>{news.summary}</CardDescription>
            )}
          </div>
          {news.imageUrl && (
            <div className='w-24 h-24 rounded-lg overflow-hidden flex-shrink-0'>
              <img src={news.imageUrl} alt={news.title} className='w-full h-full object-cover' />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Avatar className='h-8 w-8'>
              <AvatarImage src={news.createdBy.avatar || ''} />
              <AvatarFallback>{news.createdBy.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className='text-sm'>
              <p className='font-medium'>{news.createdBy.name}</p>
              <p className='text-muted-foreground flex items-center gap-1'>
                <Clock className='h-3 w-3' />
                {timeAgo}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-4 text-sm text-muted-foreground'>
            <span className='flex items-center gap-1'>
              <Eye className='h-4 w-4' />
              {news._count.news_views}
            </span>
            {news.allowReactions && (
              <span className='flex items-center gap-1'>
                <ThumbsUp className='h-4 w-4' />
                {news._count.news_reactions}
              </span>
            )}
            {news.allowComments && (
              <span className='flex items-center gap-1'>
                <MessageSquare className='h-4 w-4' />
                {news._count.news_comments}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
