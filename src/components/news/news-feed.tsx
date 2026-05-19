'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
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
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NewsCard } from './news-card'
import { NewsDetail } from './news-detail'

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
  news_views: Array<{ id: string }>
  news_reactions: Array<{ id: string; reaction: string }>
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
  NEWS: 'Noticias',
  ANNOUNCEMENT: 'Comunicados',
  EVENT: 'Eventos',
  BIRTHDAY: 'Cumpleaños',
  HOLIDAY: 'Festividades',
  ALERT: 'Alertas',
  INTERNAL_AD: 'Publicidad',
  RECOGNITION: 'Reconocimientos',
}

interface NewsFeedProps {
  className?: string
}

export function NewsFeed({ className }: NewsFeedProps) {
  const { data: session } = useSession()
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [period, setPeriod] = useState<string>('')

  const loadNews = async (tab: string = 'all', selectedPeriod: string = '') => {
    if (!session?.user) return

    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (tab !== 'all') params.set('type', tab)
      if (selectedPeriod) params.set('period', selectedPeriod)

      const response = await fetch(`/api/news?${params.toString()}`)
      if (!response.ok) throw new Error('Error al cargar noticias')
      const data = await response.json()
      setNews(data.news)
    } catch (error) {
      console.error('Error loading news:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      loadNews(activeTab, period)
    }
  }, [session])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    loadNews(tab, period)
  }

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    loadNews(activeTab, newPeriod)
  }

  const handleNewsClick = async (item: NewsItem) => {
    setSelectedNews(item)
    try {
      if (item.news_views.length === 0) {
        await fetch(`/api/news/${item.id}/view`, { method: 'POST' })
        setNews(prev => prev.map(n => (n.id === item.id ? { ...n, news_views: [{ id: '1' }] } : n)))
      }
    } catch (error) {
      console.error('Error marking as viewed:', error)
    }
  }

  const featuredNews = news.filter(n => n.isFeatured)
  const regularNews = news.filter(n => !n.isFeatured)
  const urgentNews = news.filter(n => n.priority === 'URGENT')

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <Newspaper className='h-5 w-5' />
                Centro de Noticias
              </CardTitle>
              <CardDescription>Noticias y comunicados relevantes para ti</CardDescription>
            </div>
            <div className='flex gap-2'>
              <Button
                variant={period === '' ? 'default' : 'ghost'}
                size='sm'
                onClick={() => handlePeriodChange('')}
              >
                Todo
              </Button>
              <Button
                variant={period === 'today' ? 'default' : 'ghost'}
                size='sm'
                onClick={() => handlePeriodChange('today')}
              >
                Hoy
              </Button>
              <Button
                variant={period === 'week' ? 'default' : 'ghost'}
                size='sm'
                onClick={() => handlePeriodChange('week')}
              >
                Esta semana
              </Button>
              <Button
                variant={period === 'month' ? 'default' : 'ghost'}
                size='sm'
                onClick={() => handlePeriodChange('month')}
              >
                Este mes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='all' value={activeTab} onValueChange={handleTabChange}>
            <TabsList className='mb-4 flex-wrap h-auto'>
              <TabsTrigger value='all' className='flex items-center gap-1'>
                <Newspaper className='h-3 w-3' />
                Todas
              </TabsTrigger>
              {Object.entries(typeLabels).map(([key, label]) => (
                <TabsTrigger key={key} value={key} className='flex items-center gap-1'>
                  {typeIcons[key as NewsType]}
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab} className='space-y-4'>
              {loading ? (
                <div className='space-y-4'>
                  {[1, 2, 3].map(i => (
                    <Card key={i} className='animate-pulse'>
                      <CardHeader>
                        <div className='h-4 w-3/4 bg-muted rounded' />
                        <div className='h-3 w-1/2 bg-muted rounded' />
                      </CardHeader>
                      <CardContent>
                        <div className='h-3 w-full bg-muted rounded mb-2' />
                        <div className='h-3 w-2/3 bg-muted rounded' />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : news.length === 0 ? (
                <div className='text-center py-8'>
                  <Newspaper className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
                  <h3 className='text-lg font-medium mb-2'>No hay noticias</h3>
                  <p className='text-muted-foreground'>
                    No hay noticias disponibles en este momento
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {urgentNews.length > 0 && (
                    <div className='space-y-2'>
                      <h4 className='text-sm font-semibold text-red-600 flex items-center gap-2'>
                        <AlertTriangle className='h-4 w-4' />
                        Alertas Urgentes
                      </h4>
                      <div className='grid gap-3'>
                        {urgentNews.map(item => (
                          <NewsCard
                            key={item.id}
                            news={item}
                            onClick={() => handleNewsClick(item)}
                            isUrgent
                            isViewed={item.news_views.length > 0}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {featuredNews.length > 0 && (
                    <div className='space-y-2'>
                      <h4 className='text-sm font-semibold flex items-center gap-2'>
                        <Star className='h-4 w-4 text-yellow-500' />
                        Destacados
                      </h4>
                      <div className='grid gap-3'>
                        {featuredNews.map(item => (
                          <NewsCard
                            key={item.id}
                            news={item}
                            onClick={() => handleNewsClick(item)}
                            isFeatured
                            isViewed={item.news_views.length > 0}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {regularNews.length > 0 && (
                    <div className='space-y-2'>
                      <h4 className='text-sm font-semibold'>
                        {featuredNews.length > 0 || urgentNews.length > 0
                          ? 'Más noticias'
                          : 'Noticias'}
                      </h4>
                      <div className='grid gap-3'>
                        {regularNews.map(item => (
                          <NewsCard
                            key={item.id}
                            news={item}
                            onClick={() => handleNewsClick(item)}
                            isViewed={item.news_views.length > 0}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selectedNews && (
        <NewsDetail
          news={selectedNews}
          isOpen={!!selectedNews}
          onClose={() => setSelectedNews(null)}
        />
      )}
    </div>
  )
}
