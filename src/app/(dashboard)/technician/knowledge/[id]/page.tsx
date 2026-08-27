'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Eye,
  Calendar,
  Tag,
  BookOpen,
  Share2,
  Trash2,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Componentes
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ArticleVote } from '@/components/knowledge/article-vote'
import { ArticleSourcePanel } from '@/components/knowledge/article-source-panel'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import type { Article } from '@/hooks/use-knowledge'

export default function TechnicianKnowledgeDetailPage() {
  const { data: session, status } = useSession()
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
  // Evita recargar el artículo (y, con ello, inflar el contador de vistas —
  // GET /api/knowledge/[id] incrementa `views` en cada llamada) cada vez que
  // `session` recibe una referencia nueva por el refetch periódico de NextAuth
  // (~5 min, foco de ventana, o el sync de actividad de SessionTimeoutMonitor
  // cada ~60s) — mismo patrón ya corregido en settings/backups/tickets.
  const articleLoadedRef = useRef<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return

    if (!session || session.user.role !== 'TECHNICIAN') {
      router.push('/login')
      return
    }

    if (
      articleId &&
      articleId !== 'create' &&
      articleId !== 'new' &&
      articleLoadedRef.current !== articleId
    ) {
      articleLoadedRef.current = articleId
      loadArticle()
    }
  }, [status, session?.user?.id, session?.user?.role, articleId, router]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (article) {
      loadSimilarArticles()
    }
  }, [article?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadArticle = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/knowledge/${articleId}`)

      if (response.ok) {
        const data = await response.json()
        setArticle(data)
        // Nota: los artículos similares se cargan solo vía el efecto
        // `[article?.id]` de abajo — llamarlo aquí también leía `article`
        // desde este mismo closure (aún no actualizado por el setArticle
        // recién hecho), así que en el primer render era una llamada muerta
        // y en recargas duplicaba la petición con datos obsoletos.
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
        limit: 3,
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
          error: errorData,
        })
      }
    } catch (err) {
      console.error('Error loading similar articles:', err)
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
    const url = window.location.href
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => fallbackCopy(url))
    } else {
      fallbackCopy(url)
    }
    const articleTitle = article?.title || 'el artículo'
    toast({
      title: 'Enlace copiado exitosamente',
      description: `El enlace de "${articleTitle}" se copió al portapapeles`,
      duration: 4000,
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
          duration: 4000,
        })
      } else {
        throw new Error('Error al cambiar estado')
      }
    } catch (err) {
      toast({
        title: 'Error al cambiar estado',
        description: `No se pudo ${article.isPublished ? 'despublicar' : 'publicar'} el artículo. Intenta nuevamente.`,
        variant: 'destructive',
        duration: 5000,
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
          duration: 4000,
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
        duration: 5000,
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
      subtitle='Artículo de la base de conocimientos'
      loading={loading}
      error={error}
      onRetry={loadArticle}
      headerActions={
        <div className='flex items-center gap-2'>
          {isAuthor && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={article?.isPublished ? 'outline' : 'default'}
                      size='sm'
                      onClick={handleTogglePublish}
                      disabled={toggling}
                    >
                      {article?.isPublished ? (
                        <>
                          <XCircle className='h-4 w-4 mr-2' />
                          Despublicar
                        </>
                      ) : (
                        <>
                          <CheckCircle className='h-4 w-4 mr-2' />
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
                      variant='destructive'
                      size='sm'
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className='h-4 w-4 mr-2' />
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
                <Button variant='outline' size='sm' onClick={handleShare}>
                  <Share2 className='h-4 w-4 mr-2' />
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
                <Link href='/technician/knowledge'>
                  <Button variant='outline' size='sm'>
                    <ArrowLeft className='h-4 w-4 mr-2' />
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
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Contenido principal */}
          <div className='lg:col-span-2 space-y-6'>
            {/* Estado del artículo */}
            {!article.isPublished && (
              <Card className='border-yellow-500 bg-yellow-50 dark:bg-yellow-950'>
                <CardContent className='p-4'>
                  <div className='flex items-center space-x-2'>
                    <Badge variant='secondary'>Borrador</Badge>
                    <span className='text-sm text-muted-foreground'>
                      Este artículo no está publicado y solo es visible para ti
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardContent className='p-4 sm:p-6'>
                <div className='space-y-4'>
                  {/* Categoría y tags */}
                  <div className='flex flex-wrap gap-2'>
                    {article.category && (
                      <Badge
                        variant='outline'
                        className='font-medium'
                        style={{
                          borderColor: article.category.color || undefined,
                          color: article.category.color || undefined,
                        }}
                      >
                        {article.category.name}
                      </Badge>
                    )}
                    {article.tags.map((tag, index) => (
                      <Badge key={index} variant='secondary' className='gap-1'>
                        <Tag className='h-3 w-3' />
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <Separator />

                  {/* Información del autor y fecha */}
                  <div className='flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground'>
                    <div className='flex items-center space-x-4'>
                      {article.author && (
                        <div className='flex items-center space-x-2'>
                          <Avatar className='h-8 w-8'>
                            <AvatarImage src={article.author.avatar || undefined} />
                            <AvatarFallback>
                              {article.author.name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className='font-medium text-foreground'>
                              {article.author.name || article.author.email}
                            </div>
                            <div className='text-xs'>Autor</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className='flex items-center gap-4'>
                      <div className='flex items-center gap-1.5'>
                        <Calendar className='h-4 w-4' />
                        <span>
                          {formatDistanceToNow(new Date(article.createdAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                      <div className='flex items-center gap-1.5'>
                        <Eye className='h-4 w-4' />
                        <span>{article.views} vistas</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contenido del artículo */}
            <Card>
              <CardContent className='p-6 sm:p-8'>
                <div className='markdown-body'>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
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
          <div className='space-y-6'>
            {article.sourceContext ? (
              <ArticleSourcePanel sourceContext={article.sourceContext} showStaffDetails />
            ) : (
              article.sourceTicket && (
                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>Ticket Relacionado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={`/technician/tickets/${article.sourceTicket.id}`}>
                            <Button variant='outline' className='w-full justify-start'>
                              <BookOpen className='h-4 w-4 mr-2' />
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
              )
            )}

            {/* Artículos similares */}
            {similarArticles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>Artículos Relacionados</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {similarArticles.map(similar => (
                    <Link
                      key={similar.id}
                      href={`/technician/knowledge/${similar.id}`}
                      className='block'
                    >
                      <div className='p-3 rounded-lg border hover:bg-accent transition-colors'>
                        <div className='font-medium text-sm line-clamp-2 mb-1'>{similar.title}</div>
                        <div className='flex items-center space-x-2 text-xs text-muted-foreground'>
                          <div className='flex items-center space-x-1'>
                            <Eye className='h-3 w-3' />
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
                    <span className='font-semibold text-foreground'>
                      &quot;{article.title}&quot;
                    </span>
                    <br />
                    <br />
                  </>
                )}
                Esta acción no se puede deshacer. El artículo será eliminado permanentemente de la
                base de conocimientos.
                {article?.sourceTicket && (
                  <div className='mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md'>
                    <p className='text-sm text-yellow-800 dark:text-yellow-200'>
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
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleting ? 'Eliminando...' : 'Eliminar Artículo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}
