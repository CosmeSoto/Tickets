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
  Share2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import type { Article } from '@/hooks/use-knowledge'

export default function KnowledgeDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [userVote, setUserVote] = useState<boolean | null>(null)
  const [similarArticles, setSimilarArticles] = useState<Article[]>([])

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    loadArticle()
  }, [session, params.id])

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
          limit: 3 
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

  const handleShare = () => {
    if (!article) return
    
    const url = window.location.href
    navigator.clipboard.writeText(url)
    toast({
      title: 'Enlace copiado',
      description: 'El enlace del artículo ha sido copiado al portapapeles',
    })
  }

  const canEdit = article && session && (
    session.user.role === 'ADMIN' || 
    (session.user.role === 'TECHNICIAN' && article.authorId === session.user.id)
  )

  if (!session) {
    return null
  }

  return (
    <ModuleLayout
      title={article?.title || 'Cargando...'}
      subtitle="Artículo de la base de conocimientos"
      loading={loading && !article}
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Compartir
          </Button>
        </div>
      }
    >
      {article && (
        <div className="space-y-6">
          {/* Header del artículo */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {article.category && (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: article.category.color || undefined,
                          color: article.category.color || undefined,
                        }}
                      >
                        {article.category.name}
                      </Badge>
                    )}
                    {article.isPublished ? (
                      <Badge className="bg-green-100 text-green-800">
                        Publicado
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Borrador
                      </Badge>
                    )}
                  </div>

                  <CardTitle className="text-2xl">{article.title}</CardTitle>
                  
                  {article.summary && (
                    <CardDescription className="text-base">
                      {article.summary}
                    </CardDescription>
                  )}

                  {/* Tags */}
                  {article.tags && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {article.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex flex-col items-end gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{article.views} vistas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-green-600">
                      <ThumbsUp className="h-4 w-4" />
                      <span>{article.helpfulVotes}</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-600">
                      <ThumbsDown className="h-4 w-4" />
                      <span>{article.notHelpfulVotes}</span>
                    </div>
                  </div>
                  {(article.helpfulPercentage ?? 0) > 0 && (
                    <Badge variant="secondary">
                      {article.helpfulPercentage}% útil
                    </Badge>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Metadata */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                {article.author && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={article.author.avatar || undefined} />
                      <AvatarFallback>
                        {article.author.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-foreground">
                        {article.author.name || article.author.email}
                      </div>
                      <div className="text-xs">Autor</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Publicado{' '}
                    {formatDistanceToNow(new Date(article.createdAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Contenido del artículo */}
          <Card>
            <CardHeader>
              <CardTitle>Contenido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{article.content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          {/* Sistema de votación */}
          <Card>
            <CardHeader>
              <CardTitle>¿Te resultó útil este artículo?</CardTitle>
              <CardDescription>
                Tu feedback nos ayuda a mejorar la base de conocimientos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  variant={userVote === true ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleVote(true)}
                  disabled={voting}
                  className="flex-1"
                >
                  <ThumbsUp className="h-5 w-5 mr-2" />
                  Sí, fue útil
                  {userVote === true && ' ✓'}
                </Button>
                <Button
                  variant={userVote === false ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleVote(false)}
                  disabled={voting}
                  className="flex-1"
                >
                  <ThumbsDown className="h-5 w-5 mr-2" />
                  No fue útil
                  {userVote === false && ' ✓'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Artículo fuente (si existe) */}
          {article.sourceTicket && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Artículo creado desde ticket</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/tickets/${article.sourceTicket?.id}`)}
                >
                  Ver ticket original: {article.sourceTicket.title}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Artículos similares */}
          {similarArticles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Artículos Relacionados</CardTitle>
                <CardDescription>
                  Otros artículos que podrían interesarte
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {similarArticles.map((similar) => (
                  <div
                    key={similar.id}
                    onClick={() => router.push(`/knowledge/${similar.id}`)}
                    className="p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
                  >
                    <div className="font-medium text-sm line-clamp-2 mb-1">
                      {similar.title}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Eye className="h-3 w-3" />
                        <span>{similar.views}</span>
                      </div>
                      <span>•</span>
                      <span>{similar.helpfulPercentage}% útil</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </ModuleLayout>
  )
}
