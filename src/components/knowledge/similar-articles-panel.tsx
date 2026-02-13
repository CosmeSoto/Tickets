'use client'

import { useEffect, useState } from 'react'
import { useKnowledge, Article } from '@/hooks/use-knowledge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lightbulb, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SimilarArticlesPanelProps {
  title: string
  description: string
  categoryId?: string
  maxResults?: number
  onArticleClick?: (article: Article) => void
}

export function SimilarArticlesPanel({
  title,
  description,
  categoryId,
  maxResults = 5,
  onArticleClick,
}: SimilarArticlesPanelProps) {
  const router = useRouter()
  const { getSimilar, loading } = useKnowledge()
  const [articles, setArticles] = useState<Article[]>([])
  const [keywords, setKeywords] = useState<string[]>([])

  useEffect(() => {
    const fetchSimilar = async () => {
      if (!title || title.length < 3) return

      const result = await getSimilar({
        title,
        description,
        categoryId,
        limit: maxResults,
      })

      setArticles(result)
    }

    fetchSimilar()
  }, [title, description, categoryId, maxResults, getSimilar])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Soluciones Similares
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Soluciones Similares
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">No se encontraron artículos similares</p>
            <p className="text-xs mt-1">
              Este podría ser un problema nuevo
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Soluciones Similares
        </CardTitle>
        <CardDescription>
          Estos artículos podrían ayudarte a resolver el problema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {articles.map((article, index) => (
          <div
            key={article.id}
            className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
            onClick={() => {
              if (onArticleClick) {
                onArticleClick(article)
              } else {
                router.push(`/knowledge/${article.id}`)
              }
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    #{index + 1}
                  </span>
                  {article.category && (
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: article.category.color,
                        color: article.category.color,
                      }}
                    >
                      {article.category.name}
                    </Badge>
                  )}
                </div>
                
                <h4 className="text-sm font-medium line-clamp-2 mb-1">
                  {article.title}
                </h4>
                
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {article.summary}
                </p>

                {/* Tags */}
                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {article.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Estadísticas */}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{article.views} vistas</span>
                  {article.helpfulPercentage && article.helpfulPercentage > 0 && (
                    <span className="text-green-600 font-medium">
                      {article.helpfulPercentage}% útil
                    </span>
                  )}
                </div>
              </div>

              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push('/knowledge')}
        >
          Ver más artículos
        </Button>
      </CardContent>
    </Card>
  )
}
