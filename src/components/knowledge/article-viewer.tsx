'use client'

import { useEffect, useState } from 'react'
import { useKnowledge, Article } from '@/hooks/use-knowledge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { 
  ThumbsUp, 
  ThumbsDown, 
  Eye, 
  Calendar, 
  User, 
  Loader2,
  AlertCircle,
  Edit,
  Trash2,
  Share2,
  FileText,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { ArticleStats } from './article-stats'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface ArticleViewerProps {
  articleId: string
  onVote?: (isHelpful: boolean) => void
  showActions?: boolean
}

export function ArticleViewer({
  articleId,
  onVote,
  showActions = true,
}: ArticleViewerProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { getArticle, voteArticle, deleteArticle, loading } = useKnowledge()
  const [article, setArticle] = useState<Article | null>(null)
  const [userVote, setUserVote] = useState<boolean | null>(null)
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    const fetchArticle = async () => {
      const data = await getArticle(articleId)
      if (data) {
        setArticle(data)
        setUserVote(data.userVote || null)
      }
    }

    fetchArticle()
  }, [articleId, getArticle])

  const handleVote = async (isHelpful: boolean) => {
    if (!article) return

    setVoting(true)
    try {
      const success = await voteArticle(article.id, isHelpful)
      if (success) {
        setUserVote(isHelpful)
        toast.success('Voto registrado')
        
        // Actualizar estadísticas localmente
        setArticle(prev => {
          if (!prev) return prev
          
          const wasHelpful = userVote === true
          const wasNotHelpful = userVote === false
          
          let newHelpfulVotes = prev.helpfulVotes
          let newNotHelpfulVotes = prev.notHelpfulVotes
          
          if (wasHelpful && !isHelpful) {
            newHelpfulVotes--
            newNotHelpfulVotes++
          } else if (wasNotHelpful && isHelpful) {
            newHelpfulVotes++
            newNotHelpfulVotes--
          } else if (!wasHelpful && !wasNotHelpful) {
            if (isHelpful) {
              newHelpfulVotes++
            } else {
              newNotHelpfulVotes++
            }
          }
          
          return {
            ...prev,
            helpfulVotes: newHelpfulVotes,
            notHelpfulVotes: newNotHelpfulVotes,
          }
        })
        
        onVote?.(isHelpful)
      }
    } catch (error) {
      toast.error('Error al votar')
    } finally {
      setVoting(false)
    }
  }

  const handleDelete = async () => {
    if (!article) return
    
    if (!confirm('¿Estás seguro de eliminar este artículo?')) return

    const success = await deleteArticle(article.id)
    if (success) {
      toast.success('Artículo eliminado')
      router.push('/knowledge')
    } else {
      toast.error('Error al eliminar artículo')
    }
  }

  const handleShare = async () => {
    if (!article) return
    
    const url = `${window.location.origin}/knowledge/${article.id}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.summary,
          url,
        })
      } catch (error) {
        // Usuario canceló
      }
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado al portapapeles')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!article) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Artículo no encontrado</p>
          <p className="text-sm text-muted-foreground mt-2">
            El artículo que buscas no existe o ha sido eliminado
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/knowledge')}
          >
            Volver a artículos
          </Button>
        </CardContent>
      </Card>
    )
  }

  const canEdit = session?.user?.role === 'ADMIN' || session?.user?.id === article.authorId
  const canDelete = session?.user?.role === 'ADMIN' || session?.user?.id === article.authorId

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-3">{article.title}</h1>
              
              {/* Categoría y Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {article.category && (
                  <Badge
                    variant="outline"
                    className="text-sm"
                    style={{
                      borderColor: article.category.color,
                      color: article.category.color,
                    }}
                  >
                    {article.category.name}
                  </Badge>
                )}
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Autor y Fecha */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {article.author && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={article.author.avatar} />
                      <AvatarFallback>
                        {article.author.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{article.author.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDistanceToNow(new Date(article.createdAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <span>{article.views} vistas</span>
                </div>
              </div>
            </div>

            {/* Acciones */}
            {showActions && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleShare}
                  title="Compartir"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                
                {canEdit && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => router.push(`/knowledge/${article.id}/edit`)}
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                
                {canDelete && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDelete}
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Contenido */}
      <Card>
        <CardContent className="pt-6">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
            >
              {article.content}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Ticket origen */}
      {article.sourceTicket && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Creado desde el ticket:</span>
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => router.push(`/tickets/${article.sourceTicket!.id}`)}
              >
                {article.sourceTicket.title}
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Votación y Estadísticas */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">¿Te fue útil este artículo?</h3>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Botones de votación */}
          <div className="flex items-center gap-4">
            <Button
              variant={userVote === true ? 'default' : 'outline'}
              onClick={() => handleVote(true)}
              disabled={voting}
              className="flex-1"
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              Útil
            </Button>
            <Button
              variant={userVote === false ? 'default' : 'outline'}
              onClick={() => handleVote(false)}
              disabled={voting}
              className="flex-1"
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              No útil
            </Button>
          </div>

          <Separator />

          {/* Estadísticas */}
          <ArticleStats
            views={article.views}
            helpfulVotes={article.helpfulVotes}
            notHelpfulVotes={article.notHelpfulVotes}
          />
        </CardContent>
      </Card>

      {/* Crear ticket si no resuelve */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium mb-1">¿No resolvió tu problema?</h4>
              <p className="text-sm text-muted-foreground">
                Crea un ticket y nuestro equipo te ayudará
              </p>
            </div>
            <Button onClick={() => router.push('/tickets/new')}>
              Crear Ticket
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
