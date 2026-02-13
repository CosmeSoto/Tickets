'use client'

import { Eye, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface ArticleStatsProps {
  views: number
  helpfulVotes: number
  notHelpfulVotes: number
  compact?: boolean
}

export function ArticleStats({
  views,
  helpfulVotes,
  notHelpfulVotes,
  compact = false,
}: ArticleStatsProps) {
  const totalVotes = helpfulVotes + notHelpfulVotes
  const helpfulPercentage = totalVotes > 0
    ? Math.round((helpfulVotes / totalVotes) * 100)
    : 0

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span>{views}</span>
        </div>
        <div className="flex items-center gap-1 text-green-600">
          <ThumbsUp className="h-4 w-4" />
          <span>{helpfulVotes}</span>
        </div>
        <div className="flex items-center gap-1 text-red-600">
          <ThumbsDown className="h-4 w-4" />
          <span>{notHelpfulVotes}</span>
        </div>
        {totalVotes > 0 && (
          <span className="text-xs font-medium text-green-600">
            {helpfulPercentage}% útil
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Vistas */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span>Vistas</span>
        </div>
        <span className="text-sm font-medium">{views}</span>
      </div>

      {/* Votos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Valoración</span>
          <span className="font-medium">
            {totalVotes > 0 ? `${helpfulPercentage}% útil` : 'Sin votos'}
          </span>
        </div>

        {totalVotes > 0 && (
          <>
            <Progress value={helpfulPercentage} className="h-2" />
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3 text-green-600" />
                <span>{helpfulVotes} útil</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsDown className="h-3 w-3 text-red-600" />
                <span>{notHelpfulVotes} no útil</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
