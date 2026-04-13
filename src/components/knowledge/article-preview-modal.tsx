'use client'

import { useEffect, useState } from 'react'
import { useKnowledge, Article } from '@/hooks/use-knowledge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, ExternalLink, ThumbsUp, Eye } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

interface ArticlePreviewModalProps {
  articleId: string | null
  isOpen: boolean
  onClose: () => void
  onCreateTicket?: () => void
  onResolved?: () => void
}

export function ArticlePreviewModal({
  articleId,
  isOpen,
  onClose,
  onCreateTicket,
  onResolved,
}: ArticlePreviewModalProps) {
  const { getArticle, loading } = useKnowledge()
  const [article, setArticle] = useState<Article | null>(null)

  useEffect(() => {
    if (isOpen && articleId) {
      const fetchArticle = async () => {
        const data = await getArticle(articleId)
        setArticle(data)
      }
      fetchArticle()
    }
  }, [isOpen, articleId, getArticle])

  const handleResolved = () => {
    onResolved?.()
    onClose()
  }

  const handleCreateTicket = () => {
    onCreateTicket?.()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : article ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">{article.title}</DialogTitle>
              <DialogDescription>
                <div className="flex flex-wrap gap-2 mt-2">
                  {article.category && (
                    <Badge
                      variant="outline"
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
              </DialogDescription>
            </DialogHeader>

            {/* Estadísticas */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{article.views} vistas</span>
              </div>
              {article.helpfulPercentage && article.helpfulPercentage > 0 && (
                <div className="flex items-center gap-1 text-green-600">
                  <ThumbsUp className="h-4 w-4" />
                  <span>{article.helpfulPercentage}% útil</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Contenido */}
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
              >
                {article.content}
              </ReactMarkdown>
            </div>

            <Separator />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="flex-1 text-sm text-muted-foreground">
                ¿Este artículo resolvió tu problema?
              </div>
              <div className="flex gap-2">
                {onResolved && (
                  <Button onClick={handleResolved} variant="default">
                    Sí, problema resuelto
                  </Button>
                )}
                {onCreateTicket && (
                  <Button onClick={handleCreateTicket} variant="outline">
                    No, crear ticket
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => window.open(`/knowledge/${article.id}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver completo
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            No se pudo cargar el artículo
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
