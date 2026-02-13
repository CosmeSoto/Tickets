'use client'

import { Article } from '@/hooks/use-knowledge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Eye, ThumbsUp, ThumbsDown, Calendar, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ArticleCardProps {
  article: Article
  onClick?: () => void
  showAuthor?: boolean
  showStats?: boolean
}

export function ArticleCard({
  article,
  onClick,
  showAuthor = true,
  showStats = true,
}: ArticleCardProps) {
  const helpfulPercentage = article.helpfulPercentage || 0
  const isHighlyRated = helpfulPercentage >= 80 && (article.helpfulVotes + article.notHelpfulVotes) >= 5

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-2">
              {article.title}
            </CardTitle>
            <CardDescription className="mt-2 line-clamp-2">
              {article.summary}
            </CardDescription>
          </div>
          {isHighlyRated && (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
              Muy útil
            </Badge>
          )}
        </div>

        {/* Categoría y Tags */}
        <div className="flex flex-wrap gap-2 mt-3">
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
          {article.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {article.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{article.tags.length - 3}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          {/* Autor */}
          {showAuthor && article.author && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={article.author.avatar} />
                <AvatarFallback>
                  {article.author.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{article.author.name}</span>
            </div>
          )}

          {/* Fecha */}
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span className="text-xs">
              {formatDistanceToNow(new Date(article.createdAt), {
                addSuffix: true,
                locale: es,
              })}
            </span>
          </div>
        </div>

        {/* Estadísticas */}
        {showStats && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              <span>{article.views}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <ThumbsUp className="h-3 w-3" />
              <span>{article.helpfulVotes}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-red-600">
              <ThumbsDown className="h-3 w-3" />
              <span>{article.notHelpfulVotes}</span>
            </div>
            {helpfulPercentage > 0 && (
              <div className="ml-auto text-xs font-medium text-green-600">
                {helpfulPercentage}% útil
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
