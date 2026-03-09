'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, ThumbsUp, ExternalLink, Loader2 } from 'lucide-react';
import type { KnowledgeArticle } from '../types';

export interface RelatedArticlesProps {
  categoryId: string;
  ticketTitle?: string;
  ticketDescription?: string;
  onArticleClick: (articleId: string) => void;
  maxArticles?: number;
}

interface ArticleWithRelevance {
  article: KnowledgeArticle;
  relevanceScore: number;
}

interface RelatedArticlesResponse {
  success: boolean;
  data: {
    articles: ArticleWithRelevance[];
  };
}

/**
 * Fetch related articles from API
 * Requisitos: 7.1, 7.2, 7.7, 7.8, 7.9, 9.8
 */
async function fetchRelatedArticles(
  categoryId: string,
  ticketTitle: string,
  ticketDescription: string,
  maxArticles: number
): Promise<ArticleWithRelevance[]> {
  const params = new URLSearchParams({
    categoryId,
    limit: maxArticles.toString(),
  });

  if (ticketTitle) params.append('title', ticketTitle);
  if (ticketDescription) params.append('description', ticketDescription);

  const response = await fetch(`/api/knowledge-articles/related?${params}`);
  
  if (!response.ok) {
    throw new Error('Error al cargar artículos relacionados');
  }

  const data: RelatedArticlesResponse = await response.json();
  return data.data.articles || [];
}

/**
 * RelatedArticles - Muestra artículos relacionados con carga asíncrona optimizada
 * 
 * Requisitos: 7.1, 7.2, 7.7, 7.8, 7.9, 9.8
 * 
 * Optimizaciones:
 * - Carga asíncrona con React Query (no bloquea UI)
 * - Caché automático de resultados
 * - Estados de loading optimizados
 */
export function RelatedArticles({
  categoryId,
  ticketTitle = '',
  ticketDescription = '',
  onArticleClick,
  maxArticles = 3,
}: RelatedArticlesProps) {
  // Use React Query for async loading with caching
  const { data: articles = [], isLoading, error } = useQuery<ArticleWithRelevance[], Error>({
    queryKey: ['relatedArticles', categoryId, ticketTitle, ticketDescription, maxArticles],
    queryFn: () => fetchRelatedArticles(categoryId, ticketTitle, ticketDescription, maxArticles),
    enabled: !!categoryId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Calcular si la categoría tiene alta tasa de resolución
  const hasHighResolutionRate = articles.some((item) => {
    const total = item.article.helpfulVotes + item.article.notHelpfulVotes;
    return total > 0 && item.article.helpfulVotes / total > 0.7;
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Artículos Relacionados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Cargando artículos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Artículos Relacionados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Artículos Relacionados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay artículos disponibles para esta categoría. El equipo de soporte atenderá tu caso.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Artículos Relacionados
          {hasHighResolutionRate && (
            <Badge variant="secondary" className="ml-2">
              Soluciones disponibles
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Estos artículos pueden ayudarte a resolver tu problema sin crear un ticket
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {articles.map(({ article, relevanceScore }) => (
          <div
            key={article.id}
            className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <h4 className="font-medium leading-tight">{article.title}</h4>
                {article.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {article.summary}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4" />
                    <span>{article.helpfulVotes} útiles</span>
                  </div>
                  {relevanceScore > 0.7 && (
                    <Badge variant="outline" className="text-xs">
                      Alta relevancia
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onArticleClick(article.id)}
                className="shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
