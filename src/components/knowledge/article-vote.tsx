'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface ArticleVoteProps {
  articleId: string
  helpfulVotes: number
  notHelpfulVotes: number
  userVote?: boolean | null
  onVoteChange?: () => void
}

export function ArticleVote({
  articleId,
  helpfulVotes,
  notHelpfulVotes,
  userVote,
  onVoteChange,
}: ArticleVoteProps) {
  const { toast } = useToast()
  const [voting, setVoting] = useState(false)
  const [currentVote, setCurrentVote] = useState<boolean | null>(userVote ?? null)
  const [votes, setVotes] = useState({ helpful: helpfulVotes, notHelpful: notHelpfulVotes })

  const handleVote = async (isHelpful: boolean) => {
    setVoting(true)
    try {
      // Si ya votó lo mismo, remover voto
      if (currentVote === isHelpful) {
        const response = await fetch(`/api/knowledge/${articleId}/vote`, {
          method: 'DELETE',
        })

        if (response.ok) {
          setCurrentVote(null)
          setVotes(prev => ({
            helpful: isHelpful ? prev.helpful - 1 : prev.helpful,
            notHelpful: !isHelpful ? prev.notHelpful - 1 : prev.notHelpful,
          }))
          toast({
            title: 'Voto removido',
            description: 'Tu voto ha sido eliminado',
          })
          onVoteChange?.()
        }
      } else {
        // Votar o cambiar voto
        const response = await fetch(`/api/knowledge/${articleId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isHelpful }),
        })

        if (response.ok) {
          const previousVote = currentVote
          setCurrentVote(isHelpful)
          
          setVotes(prev => {
            let helpful = prev.helpful
            let notHelpful = prev.notHelpful

            // Remover voto anterior si existía
            if (previousVote === true) helpful--
            if (previousVote === false) notHelpful--

            // Agregar nuevo voto
            if (isHelpful) helpful++
            else notHelpful++

            return { helpful, notHelpful }
          })

          toast({
            title: isHelpful ? '¡Gracias!' : 'Gracias por tu feedback',
            description: isHelpful 
              ? 'Tu voto ayuda a mejorar el contenido'
              : 'Trabajaremos en mejorar este artículo',
          })
          onVoteChange?.()
        } else {
          throw new Error('Error al votar')
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo registrar tu voto',
        variant: 'destructive',
      })
    } finally {
      setVoting(false)
    }
  }

  const totalVotes = votes.helpful + votes.notHelpful
  const helpfulPercentage = totalVotes > 0 
    ? Math.round((votes.helpful / totalVotes) * 100) 
    : 0

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">¿Te resultó útil este artículo?</h3>
            <p className="text-sm text-muted-foreground">
              Tu opinión nos ayuda a mejorar el contenido
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant={currentVote === true ? 'default' : 'outline'}
              size="lg"
              onClick={() => handleVote(true)}
              disabled={voting}
              className={cn(
                'flex-1',
                currentVote === true && 'bg-green-600 hover:bg-green-700'
              )}
            >
              <ThumbsUp className="h-5 w-5 mr-2" />
              Útil ({votes.helpful})
            </Button>

            <Button
              variant={currentVote === false ? 'default' : 'outline'}
              size="lg"
              onClick={() => handleVote(false)}
              disabled={voting}
              className={cn(
                'flex-1',
                currentVote === false && 'bg-red-600 hover:bg-red-700'
              )}
            >
              <ThumbsDown className="h-5 w-5 mr-2" />
              No útil ({votes.notHelpful})
            </Button>
          </div>

          {totalVotes > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {totalVotes} {totalVotes === 1 ? 'persona ha' : 'personas han'} votado
                </span>
                <span className="font-medium text-green-600">
                  {helpfulPercentage}% útil
                </span>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all"
                  style={{ width: `${helpfulPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
