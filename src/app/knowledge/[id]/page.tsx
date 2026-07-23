'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import {
  BookOpen,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  User,
  Tag,
  ArrowLeft,
  Edit,
  Share2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArticleVote } from '@/components/knowledge/article-vote'
import { ArticleSourcePanel } from '@/components/knowledge/article-source-panel'
import { useToast } from '@/hooks/use-toast'
import type { Article } from '@/hooks/use-knowledge'

function filterArticleContent(content: string): string {
  // Remover secciones de métricas y calificaciones para clientes
  const patterns = [
    /#{2,3}\s*📊?\s*Métricas de Resolución[\s\S]*?(?=#{2,3}\s|$)/gi,
    /#{2,3}\s*⭐?\s*Calificación del Cliente[\s\S]*?(?=#{2,3}\s|$)/gi,
  ]

  let filteredContent = content
  patterns.forEach(pattern => {
    filteredContent = filteredContent.replace(pattern, '')
  })

  return filteredContent.trim()
}

export default function KnowledgeDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [userVote, setUserVote] = useState<boolean | null>(null)
  const [similarArticles, setSimilarArticles] = useState<Article[]>([])

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    loadArticle()
  }, [session, status, params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadArticle = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/knowledge/${params.id}`)

      if (!response.ok) {
        throw new Error('Error al cargar el artículo')
      }

      const data = await response.json()
      setArticle(data)
      setUserVote(data.userVote)

      // Cargar artículos similares después de cargar el artículo
      loadSimilarArticles(data)
    } catch (error) {
      console.error('Error loading article:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cargar el artículo',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadSimilarArticles = async (currentArticle: Article) => {
    try {
      const response = await fetch(`/api/knowledge/similar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentArticle.title,
          description: currentArticle.summary || currentArticle.content.substring(0, 200),
          categoryId: currentArticle.categoryId,
          limit: 3,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Filtrar el artículo actual de los resultados
        const filtered = (data.articles || []).filter((a: Article) => a.id !== currentArticle.id)
        setSimilarArticles(filtered)
      }
    } catch (err) {
      console.error('Error loading similar articles:', err)
    }
  }

  const handleVote = async (isHelpful: boolean) => {
    if (!article) return

    try {
      setVoting(true)

      // Si ya votó lo mismo, remover voto
      if (userVote === isHelpful) {
        const response = await fetch(`/api/knowledge/${article.id}/vote`, {
          method: 'DELETE',
        })

        if (response.ok) {
          setUserVote(null)
          toast({
            title: 'Voto removido',
            description: 'Tu voto ha sido removido',
          })
          loadArticle()
        }
      } else {
        // Votar
        const response = await fetch(`/api/knowledge/${article.id}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isHelpful }),
        })

        if (response.ok) {
          setUserVote(isHelpful)
          toast({
            title: 'Gracias por tu voto',
            description: isHelpful
              ? 'Has marcado este artículo como útil'
              : 'Gracias por tu feedback',
          })
          loadArticle()
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo registrar tu voto',
        variant: 'destructive',
      })
    } finally {
      setVoting(false)
    }
  }

  const handleEdit = () => {
    if (!article) return

    if (session?.user.role === 'ADMIN') {
      router.push(`/admin/knowledge/${article.id}/edit`)
    } else if (session?.user.role === 'TECHNICIAN') {
      router.push(`/technician/knowledge/${article.id}/edit`)
    }
  }

  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    try {
      document.execCommand('copy')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
    document.body.removeChild(el)
  }

  const handleShare = () => {
    if (!article) return

    const url = window.location.href
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => fallbackCopy(url))
    } else {
      fallbackCopy(url)
    }
    toast({
      title: 'Enlace copiado',
      description: 'El enlace del artículo ha sido copiado al portapapeles',
    })
  }

  const canEdit =
    article &&
    session &&
    (session.user.role === 'ADMIN' ||
      (session.user.role === 'TECHNICIAN' && article.authorId === session.user.id))

  if (!session) {
    return null
  }

  return (
    <ModuleLayout
      title={article?.title || 'Cargando...'}
      subtitle='Artículo de la base de conocimientos'
      loading={loading && !article}
      headerActions={
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={() => router.back()}>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Volver
          </Button>
          {canEdit && (
            <Button variant='outline' size='sm' onClick={handleEdit}>
              <Edit className='h-4 w-4 mr-2' />
              Editar
            </Button>
          )}
          <Button variant='outline' size='sm' onClick={handleShare}>
            <Share2 className='h-4 w-4 mr-2' />
            Compartir
          </Button>
        </div>
      }
    >
      {article && (
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Contenido principal */}
          <div className='lg:col-span-2 space-y-6'>
            {/* Metadata */}
            <Card>
              <CardContent className='p-6'>
                <div className='space-y-4'>
                  {/* Categoría y tags */}
                  <div className='flex flex-wrap gap-2'>
                    {article.category && (
                      <Badge
                        variant='outline'
                        style={{
                          borderColor: article.category.color || undefined,
                          color: article.category.color || undefined,
                        }}
                      >
                        {article.category.name}
                      </Badge>
                    )}
                    {article.tags &&
                      article.tags.length > 0 &&
                      article.tags.map((tag, index) => (
                        <Badge key={index} variant='secondary'>
                          <Tag className='h-3 w-3 mr-1' />
                          {tag}
                        </Badge>
                      ))}
                  </div>

                  <Separator />

                  {/* Título y resumen */}
                  <div>
                    <h1 className='text-2xl font-bold mb-2'>{article.title}</h1>
                    {article.summary && <p className='text-muted-foreground'>{article.summary}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contenido del artículo */}
            <Card>
              <CardContent className='p-6 sm:p-8'>
                <div className='markdown-body'>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {filterArticleContent(article.content)}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>

            {/* Sistema de votación */}
            <ArticleVote
              articleId={article.id}
              helpfulVotes={article.helpfulVotes}
              notHelpfulVotes={article.notHelpfulVotes}
              userVote={article.userVote}
              onVoteChange={loadArticle}
            />

            {/* Artículos similares */}
            {similarArticles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Artículos Relacionados</CardTitle>
                  <CardDescription>Otros artículos que podrían interesarte</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {similarArticles.map(similar => (
                    <div
                      key={similar.id}
                      onClick={() => router.push(`/knowledge/${similar.id}`)}
                      className='p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer'
                    >
                      <div className='font-medium text-sm line-clamp-2 mb-1'>{similar.title}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className='space-y-6'>
            {article.sourceContext && (
              <ArticleSourcePanel
                sourceContext={article.sourceContext}
                showStaffDetails={
                  session.user.role === 'ADMIN' || session.user.role === 'TECHNICIAN'
                }
              />
            )}
          </div>
        </div>
      )}
    </ModuleLayout>
  )
}
