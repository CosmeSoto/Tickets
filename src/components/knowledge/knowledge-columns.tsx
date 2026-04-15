'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, ThumbsUp, Calendar, BookOpen, Tag, Trash2, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Column } from '@/components/ui/data-table'
import type { Article } from '@/hooks/use-knowledge'

interface KnowledgeColumnsProps {
  onView: (article: Article) => void
  onDelete?: (article: Article) => void
  currentUserId?: string
  showFamily?: boolean
}

export function createKnowledgeColumns({
  onView,
  onDelete,
  currentUserId,
  showFamily = false,
}: KnowledgeColumnsProps): Column<Article>[] {
  const columns: Column<Article>[] = [
    {
      key: 'title',
      label: 'Artículo',
      render: (article: Article) => (
        <div className="space-y-1 min-w-[300px]">
          <div className="flex items-start space-x-2">
            <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="font-medium">{article.title}</div>
          </div>
          {article.summary && (
            <div className="text-xs text-muted-foreground line-clamp-2 ml-6">
              {article.summary}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Categoría',
      render: (article: Article) => {
        if (!article.category) return <span className="text-muted-foreground">-</span>
        
        return (
          <Badge
            variant="outline"
            style={{
              borderColor: article.category.color || undefined,
              color: article.category.color || undefined,
            }}
          >
            {article.category.name}
          </Badge>
        )
      },
    },
  ]

  // Columna de familia — solo cuando hay múltiples familias (admin/técnico)
  if (showFamily) {
    columns.push({
      key: 'family',
      label: 'Área',
      render: (article: Article) => {
        if (!article.family) return <span className="text-muted-foreground text-xs">General</span>
        return (
          <div className="flex items-center gap-1.5">
            {article.family.color && (
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: article.family.color }}
              />
            )}
            <span className="text-sm font-medium">{article.family.name}</span>
            <span className="text-xs text-muted-foreground font-mono">({article.family.code})</span>
          </div>
        )
      },
    })
  }

  columns.push(
    {
      key: 'tags',
      label: 'Tags',
      render: (article: Article) => {
        if (!article.tags || article.tags.length === 0) {
          return <span className="text-muted-foreground">-</span>
        }
        
        return (
          <div className="flex flex-wrap gap-1">
            {article.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                <Tag className="h-2.5 w-2.5 mr-1" />
                {tag}
              </Badge>
            ))}
            {article.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{article.tags.length - 3}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      key: 'author',
      label: 'Autor',
      render: (article: Article) => {
        if (!article.author) return <span className="text-muted-foreground">-</span>
        
        return (
          <div className="text-sm">
            <div className="font-medium">{article.author.name || article.author.email}</div>
            <div className="text-xs text-muted-foreground flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>
                {formatDistanceToNow(new Date(article.createdAt), {
                  addSuffix: true,
                  locale: es,
                })}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'stats',
      label: 'Estadísticas',
      render: (article: Article) => (
        <div className="space-y-1">
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1">
              <Eye className="h-3 w-3 text-muted-foreground" />
              <span>{article.views}</span>
            </div>
            <div className="flex items-center space-x-1 text-green-600">
              <ThumbsUp className="h-3 w-3" />
              <span>{article.helpfulVotes}</span>
            </div>
          </div>
          {article.helpfulPercentage !== undefined && article.helpfulPercentage > 0 && (
            <Badge variant="secondary" className="text-xs">
              {article.helpfulPercentage}% útil
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      render: (article: Article) => (
        <Badge variant={article.isPublished ? 'default' : 'secondary'}>
          {article.isPublished ? 'Publicado' : 'Borrador'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (article: Article) => {
        const canDelete = onDelete && (currentUserId === article.authorId || !currentUserId)
        
        return (
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(article)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(article)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        )
      },
    },
  )

  return columns
}
