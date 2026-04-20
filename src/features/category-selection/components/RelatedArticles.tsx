'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, ThumbsUp, ExternalLink, Loader2, Search } from 'lucide-react';
import type { KnowledgeArticle } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchRelatedArticles(
  categoryId: string,
  ticketTitle: string,
  ticketDescription: string,
  maxArticles: number
): Promise<ArticleWithRelevance[]> {
  const params = new URLSearchParams({ categoryId, limit: maxArticles.toString() });
  if (ticketTitle) params.append('title', ticketTitle);
  if (ticketDescription) params.append('description', ticketDescription);
  const res = await fetch(`/api/knowledge-articles/related?${params}`);
  if (!res.ok) throw new Error('Error al cargar artículos relacionados');
  const data = await res.json();
  return data.data.articles || [];
}

async function searchArticles(query: string): Promise<ArticleWithRelevance[]> {
  if (query.trim().length < 2) return [];
  const params = new URLSearchParams({ query, limit: '8' });
  const res = await fetch(`/api/knowledge-articles/search?${params}`);
  if (!res.ok) throw new Error('Error al buscar artículos');
  const data = await res.json();
  return data.data.results || [];
}

// ── Article row ───────────────────────────────────────────────────────────────

function ArticleRow({
  article,
  relevanceScore,
  onArticleClick,
}: {
  article: KnowledgeArticle;
  relevanceScore: number;
  onArticleClick: (id: string) => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors cursor-pointer group"
      onClick={() => onArticleClick(article.id)}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{article.title}</p>
        {article.summary && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{article.summary}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <ThumbsUp className="h-3 w-3" />{article.helpfulVotes}
          </span>
          {relevanceScore > 0.7 && (
            <Badge variant="secondary" className="text-xs px-1 py-0">Alta relevancia</Badge>
          )}
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Componente unificado: muestra artículos relacionados + búsqueda en KB
 * en un bloque compacto con dos pestañas.
 */
export function RelatedArticles({
  categoryId,
  ticketTitle = '',
  ticketDescription = '',
  onArticleClick,
  maxArticles = 3,
}: RelatedArticlesProps) {
  const [tab, setTab] = React.useState<'related' | 'search'>('related');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const timerRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  // Related articles query
  const { data: related = [], isLoading: loadingRelated } = useQuery<ArticleWithRelevance[], Error>({
    queryKey: ['relatedArticles', categoryId, ticketTitle, ticketDescription, maxArticles],
    queryFn: () => fetchRelatedArticles(categoryId, ticketTitle, ticketDescription, maxArticles),
    enabled: !!categoryId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Search query
  const { data: searchResults = [], isLoading: loadingSearch } = useQuery<ArticleWithRelevance[], Error>({
    queryKey: ['kbSearch', debouncedQuery],
    queryFn: () => searchArticles(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), 400);
  };

  React.useEffect(() => () => clearTimeout(timerRef.current), []);

  const tabClass = (active: boolean) =>
    `flex-1 text-xs py-1 rounded transition-colors ${
      active
        ? 'bg-background shadow-sm font-medium text-foreground'
        : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">Base de Conocimientos</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1.5 bg-muted/20 border-b">
        <button type="button" className={tabClass(tab === 'related')} onClick={() => setTab('related')}>
          Artículos relacionados {related.length > 0 && `(${related.length})`}
        </button>
        <button type="button" className={tabClass(tab === 'search')} onClick={() => setTab('search')}>
          Buscar artículos
        </button>
      </div>

      {/* Content */}
      <div className="p-2">
        {tab === 'related' && (
          <>
            {loadingRelated && (
              <div className="flex items-center gap-2 py-3 px-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cargando artículos...
              </div>
            )}
            {!loadingRelated && related.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-2">
                No hay artículos disponibles para esta categoría.
              </p>
            )}
            {!loadingRelated && related.length > 0 && (
              <div className="space-y-0.5">
                {related.map(({ article, relevanceScore }) => (
                  <ArticleRow
                    key={article.id}
                    article={article}
                    relevanceScore={relevanceScore}
                    onArticleClick={onArticleClick}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'search' && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar en la base de conocimientos..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            {loadingSearch && (
              <div className="flex items-center gap-2 py-2 px-1 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando...
              </div>
            )}

            {!loadingSearch && debouncedQuery.length >= 2 && searchResults.length === 0 && (
              <p className="text-xs text-muted-foreground px-1 py-1">
                No se encontraron artículos para tu búsqueda.
              </p>
            )}

            {!loadingSearch && searchResults.length > 0 && (
              <div className="space-y-0.5">
                {searchResults.map(({ article, relevanceScore }) => (
                  <ArticleRow
                    key={article.id}
                    article={article}
                    relevanceScore={relevanceScore}
                    onArticleClick={onArticleClick}
                  />
                ))}
              </div>
            )}

            {debouncedQuery.length < 2 && !loadingSearch && (
              <p className="text-xs text-muted-foreground px-1">
                Escribe al menos 2 caracteres para buscar.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
