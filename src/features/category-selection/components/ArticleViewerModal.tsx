'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThumbsUp, ThumbsDown, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { KnowledgeArticle } from '../types';

export interface ArticleViewerModalProps {
  articleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkResolved: () => void;
  onContinueWithTicket: () => void;
}

export function ArticleViewerModal({
  articleId,
  open,
  onOpenChange,
  onMarkResolved,
  onContinueWithTicket,
}: ArticleViewerModalProps) {
  const [article, setArticle] = React.useState<KnowledgeArticle | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasVoted, setHasVoted] = React.useState(false);
  const [voteType, setVoteType] = React.useState<'helpful' | 'not_helpful' | null>(null);

  React.useEffect(() => {
    const fetchArticle = async () => {
      if (!articleId || !open) return;

      setIsLoading(true);
      setError(null);
      setHasVoted(false);
      setVoteType(null);

      try {
        const response = await fetch(`/api/knowledge-articles/${articleId}`);

        if (!response.ok) {
          throw new Error('Error al cargar el artículo');
        }

        const data = await response.json();
        setArticle(data.data.article);

        // Incrementar contador de vistas
        await fetch(`/api/knowledge-articles/${articleId}/view`, {
          method: 'POST',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [articleId, open]);

  const handleVote = async (isHelpful: boolean) => {
    if (!articleId || hasVoted) return;

    try {
      const response = await fetch(`/api/knowledge-articles/${articleId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHelpful }),
      });

      if (response.ok) {
        setHasVoted(true);
        setVoteType(isHelpful ? 'helpful' : 'not_helpful');

        // Actualizar contadores localmente
        if (article) {
          setArticle({
            ...article,
            helpfulVotes: isHelpful
              ? article.helpfulVotes + 1
              : article.helpfulVotes,
            notHelpfulVotes: !isHelpful
              ? article.notHelpfulVotes + 1
              : article.notHelpfulVotes,
          });
        }
      }
    } catch (err) {
      console.error('Error voting on article:', err);
    }
  };

  const handleMarkResolved = async () => {
    if (!articleId) return;

    // Registrar que el artículo resolvió el problema
    try {
      await fetch('/api/analytics/category-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'article_resolved',
          metadata: { articleId },
        }),
      });
    } catch (err) {
      console.error('Error logging article resolution:', err);
    }

    onMarkResolved();
  };

  const handleContinueWithTicket = async () => {
    if (!articleId) return;

    // Registrar que leyó el artículo pero continúa con el ticket
    try {
      await fetch('/api/analytics/category-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'article_read_continue',
          metadata: { articleId },
        }),
      });
    } catch (err) {
      console.error('Error logging article interaction:', err);
    }

    onContinueWithTicket();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="py-8 text-center">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {article && !isLoading && !error && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">{article.title}</DialogTitle>
              {article.summary && (
                <DialogDescription className="text-base">
                  {article.summary}
                </DialogDescription>
              )}
              <div className="flex items-center gap-2 pt-2">
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </DialogHeader>

            <Separator className="my-4" />

            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div dangerouslySetInnerHTML={{ __html: article.content }} />
            </div>

            <Separator className="my-4" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">¿Te resultó útil este artículo?</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant={voteType === 'helpful' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleVote(true)}
                    disabled={hasVoted}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    Útil ({article.helpfulVotes})
                  </Button>
                  <Button
                    variant={voteType === 'not_helpful' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleVote(false)}
                    disabled={hasVoted}
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    No útil ({article.notHelpfulVotes})
                  </Button>
                </div>
              </div>

              {hasVoted && (
                <p className="text-sm text-muted-foreground">
                  Gracias por tu retroalimentación
                </p>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
              <Button
                variant="default"
                onClick={handleMarkResolved}
                className="w-full sm:w-auto"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Problema resuelto
              </Button>
              <Button
                variant="outline"
                onClick={handleContinueWithTicket}
                className="w-full sm:w-auto"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Continuar con ticket
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
