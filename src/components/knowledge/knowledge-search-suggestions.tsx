'use client'

import { useEffect, useState } from 'react'
import { useKnowledge, Article } from '@/hooks/use-knowledge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Lightbulb, ExternalLink, Loader2, Search } from 'lucide-react'

interface KnowledgeSearchSuggestionsProps {
  title: string
  description: string
  categoryId?: string
  onArticleClick: (article: Article) => void
}

export function KnowledgeSearchSuggestions({
  title,
  description,
  categoryId,
  onArticleClick,
}: KnowledgeSearchSuggestionsProps) {
  const { getSimilar, loading } = useKnowledge()
  const [articles, setArticles] = useState<Article[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    const searchSimilar = async () => {
      // Solo buscar si hay título con al menos 10 caracteres
      if (!title || title.length < 10) {
        setArticles([])
        setHasSearched(false)
        return
      }

      setHasSearched(true)
      const result = await getSimilar({
        title,
        description,
        categoryId,
        limit: 3,
      })

      setArticles(result)
    }

    // Debounce de 500ms
    const timer = setTimeout(searchSimilar, 500)
    return () => clearTimeout(timer)
  }, [title, description, categoryId, getSimilar])

  // No mostrar nada si no hay título suficiente
  if (!title || title.length < 10) {
    return null
  }

  // Loading state
  if (loading) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Buscando soluciones similares...</AlertTitle>
        <AlertDescription>
          Estamos revisando nuestra base de conocimientos
        </AlertDescription>
      </Alert>
    )
  }

  // No se encontraron artículos
  if (hasSearched && articles.length === 0) {
    return (
      <Alert>
        <Search className="h-4 w-4" />
        <AlertTitle>No encontramos soluciones similares</AlertTitle>
        <AlertDescription>
          Parece ser un problema nuevo. Continúa creando el ticket.
        </AlertDescription>
      </Alert>
    )
  }

  // Mostrar sugerencias
  if (articles.length > 0) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            ¿Es alguno de estos tu problema?
          </CardTitle>
          <CardDescription>
            Encontramos soluciones similares que podrían ayudarte
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {articles.map((article, index) => (
            <div
              key={article.id}
              className="p-3 bg-white dark:bg-gray-900 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onArticleClick(article)}
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
                    {article.helpfulPercentage && article.helpfulPercentage >= 80 && (
                      <Badge variant="default" className="text-xs bg-green-500">
                        Muy útil
                      </Badge>
                    )}
                  </div>
                  
                  <h4 className="text-sm font-medium line-clamp-2 mb-1">
                    {article.title}
                  </h4>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {article.summary}
                  </p>

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

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              ¿Alguno de estos resuelve tu problema?
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => window.open('/knowledge', '_blank')}
            >
              Ver más artículos
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
