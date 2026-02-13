'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, ThumbsUp, ThumbsDown, Calendar, User, Tag, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Article } from '@/hooks/use-knowledge'

interface KnowledgeCardProps {
  article: Article
  onView?: (article: Article) => void
  onDelete?: (article: Article) => void
  canEdit?: boolean
  canDelete?: boolean
}

export function KnowledgeCard({
  article,
  onView,
  onDelete,
  canEdit = false,
  canDelete = false,
}: KnowledgeCardProps) {
  const helpfulPercentage = article.helpfulPercentage || 0
  const isHighlyRated = helpfulPercentage >= 80 && (article.helpfulVotes + article.notHelpfulVotes) >= 5

  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            {article.category && (
              <Badge
                variant="outline"
                className="mb-2"
                style={{
                  borderColor: article.category.color || undefined,
                  color: article.category.color || undefined,
                }}
              >
                {article.category.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isHighlyRated && (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-xs">
                Muy útil
              </Badge>
            )}
            {article.isPublished ? (
              <Badge className="bg-green-100 text-green-800 text-xs">
                Publicado
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Borrador
              </Badge>
            )}
          </div>
        </div>

        <CardTitle className="text-base line-clamp-2 cursor-pointer" onClick={() => onView?.(article)}>
          {article.title}
        </CardTitle>
        
        <CardDescription className="text-xs line-clamp-3 mt-2">
          {article.summary || 'Sin resumen disponible'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
              {article.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{article.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {article.author && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[120px]">
                  {article.author.name || article.author.email}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                {formatDistanceToNow(new Date(article.createdAt), {
                  addSuffix: true,
                  locale: es,
                })}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Eye className="h-3 w-3" />
                <span>{article.views}</span>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <ThumbsUp className="h-3 w-3" />
                <span>{article.helpfulVotes}</span>
              </div>
              <div className="flex items-center gap-1 text-red-600">
                <ThumbsDown className="h-3 w-3" />
                <span>{article.notHelpfulVotes}</span>
              </div>
            </div>
            {helpfulPercentage > 0 && (
              <Badge variant="secondary" className="text-xs">
                {helpfulPercentage}% útil
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        {(canDelete) && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation()
                onView?.(article)
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver
            </Button>
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.(article)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
