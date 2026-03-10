'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Eye, Calendar, Tag, BookOpen, Share2, Trash2, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Componentes
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ArticleVote } from '@/components/knowledge/article-vote'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import type { Article } from '@/hooks/use-knowledge'

export default function TechnicianKnowledgeDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  
  const articleId = params.id as string
  
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [similarArticles, setSimilarArticles] = useState<Article[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (!session || session.user.role !== 'TECHNICIAN') {
      router.push('/login')
      return
    }

    // Evitar cargar si el ID es "create" o "new"
    if (articleId && articleId !== 'create' && articleId !== 'new') {
      loadArticle()
    }
  }, [session, articleId, router])

  useEffect(() => {
    if (article) {
      loadSimilarArticles()
    }
  }, [article?.id])

  const loadArticle = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/knowledge/${articleId}`)
      
      if (response.ok) {
        const data = await response.json()
        setArticle(data)
        // Cargar artículos similares después de cargar el artículo
        loadSimilarArticles()
      } else {
        setError('Artículo no encontrado')
      }
    } catch (err) {
      setError('Error al cargar el artículo')
    } finally {
      setLoading(false)
    }
  }

  const loadSimilarArticles = async () => {
    if (!article) return
    
    try {
      const payload = { 
        title: article.title || '',
        description: article.summary || article.content?.substring(0, 200) || '',
        categoryId: article.categoryId || '',
        limit: 3 
      }
      
      console.log('[Similar Articles] Sending payload:', payload)
      
      const response = await fetch(`/api/knowledge/similar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      if (response.ok) {
        const data = await response.json()
        // Filtrar el artículo actual de los resultados
        const filtered = (data.articles || []).filter((a: Article) => a.id !== article.id)
        setSimilarArticles(filtered)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error loading similar articles:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
      }
    } catch (err) {
      console.error('Error loading similar articles:', err)
    }
  }

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    const articleTitle = article?.title || 'el artículo'
    toast({
      title: 'Enlace copiado exitosamente',
      description: `El enlace de "${articleTitle}" se copió al portapapeles`,
      duration: 4000
    })
  }

  const handleTogglePublish = async () => {
    if (!article) return

    const articleTitle = article.title
    setToggling(true)
    try {
      const response = await fetch(`/api/knowledge/${articleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !article.isPublished }),
      })

      if (response.ok) {
        const updated = await response.json()
        setArticle(updated)
        toast({
          title: updated.isPublished ? 'Artículo publicado exitosamente' : 'Artículo despublicado',
          description: updated.isPublished 
            ? `"${articleTitle}" está ahora visible para todos los usuarios`
            : `"${articleTitle}" ya no es visible públicamente`,
          duration: 4000
        })
      } else {
        throw new Error('Error al cambiar estado')
      }
    } catch (err) {
      toast({
        title: 'Error al cambiar estado',
        description: `No se pudo ${article.isPublished ? 'despublicar' : 'publicar'} el artículo. Intenta nuevamente.`,
        variant: 'destructive',
        duration: 5000
      })
    } finally {
      setToggling(false)
    }
  }

  const handleDelete = async () => {
    const articleTitle = article?.title || 'el artículo'
    setDeleting(true)
    try {
      const response = await fetch(`/api/knowledge/${articleId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Artículo eliminado',
          description: `"${articleTitle}" ha sido eliminado permanentemente de la base de conocimientos`,
          duration: 4000
        })
        router.push('/technician/knowledge')
      } else {
        throw new Error('Error al eliminar')
      }
    } catch (err) {
      toast({
        title: 'Error al eliminar artículo',
        description: 'No se pudo eliminar el artículo. Intenta nuevamente.',
        variant: 'destructive',
        duration: 5000
      })
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const isAuthor = article && session?.user?.id === article.authorId

  if (!session || session.user.role !== 'TECHNICIAN') {
    return null
  }

  return (
    <ModuleLayout
      title={article?.title || 'Cargando...'}
      subtitle="Artículo de la base de conocimientos"
      loading={loading}
      error={error}
      onRetry={loadArticle}
      headerActions={
        <div className="flex items-center gap-2">
          {isAuthor && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={article?.isPublished ? 'outline' : 'default'}
                      size="sm"
                      onClick={handleTogglePublish}
                      disabled={toggling}
                    >
                      {article?.isPublished ? (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Despublicar
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Publicar
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {article?.isPublished 
                        ? 'Oculta este artículo de la base de conocimientos pública' 
                        : 'Publica este artículo para que sea visible a todos los usuarios'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Elimina permanentemente este artículo de la base de conocimientos</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartir
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copia el enlace de este artículo al portapapeles</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/technician/knowledge">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Volver a la lista de artículos</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      }
    >
      {article && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contenido principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Estado del artículo */}
            {!article.isPublished && (
              <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">Borrador</Badge>
                    <span className="text-sm text-muted-foreground">
                      Este artículo no está publicado y solo es visible para ti
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Categoría y tags */}
                  <div className="flex flex-wrap gap-2">
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
                    {article.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <Separator />

                  {/* Información del autor y fecha */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center space-x-4">
                      {article.author && (
                        <div className="flex items-center space-x-2">
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
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {formatDistanceToNow(new Date(article.createdAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Eye className="h-4 w-4" />
                        <span>{article.views} vistas</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contenido del artículo */}
            <Card>
              <CardContent className="p-6">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="whitespace-pre-wrap">{article.content}</div>
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Ticket relacionado */}
            {article.sourceTicket && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ticket Relacionado</CardTitle>
                </CardHeader>
                <CardContent>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={`/technician/tickets/${article.sourceTicket.id}`}>
                          <Button variant="outline" className="w-full justify-start">
                            <BookOpen className="h-4 w-4 mr-2" />
                            {article.sourceTicket.title}
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Ver el ticket del cual se creó este artículo</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardContent>
              </Card>
            )}

            {/* Artículos similares */}
            {similarArticles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Artículos Relacionados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {similarArticles.map((similar) => (
                    <Link
                      key={similar.id}
                      href={`/technician/knowledge/${similar.id}`}
                      className="block"
                    >
                      <div className="p-3 rounded-lg border hover:bg-accent transition-colors">
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
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar artículo?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {article && (
                  <>
                    Estás a punto de eliminar:{' '}
                    <span className="font-semibold text-foreground">
                      "{article.title}"
                    </span>
                    <br /><br />
                  </>
                )}
                Esta acción no se puede deshacer. El artículo será eliminado permanentemente
                de la base de conocimientos.
                {article?.sourceTicket && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      ⚠️ Este artículo está vinculado al ticket: {article.sourceTicket.title}
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando...' : 'Eliminar Artículo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}
