'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, ThumbsUp, Loader2 } from 'lucide-react';
import type { KnowledgeArticle } from '../types';

export interface KnowledgeBaseSearchProps {
  onArticleClick: (articleId: string) => void;
  placeholder?: string;
}

interface SearchResultItem {
  article: KnowledgeArticle;
  relevanceScore: number;
}

export function KnowledgeBaseSearch({
  onArticleClick,
  placeholder = 'Buscar en la base de conocimientos...',
}: KnowledgeBaseSearchProps) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Debounce search
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const performSearch = React.useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        query: searchQuery,
        limit: '10',
      });

      const response = await fetch(`/api/knowledge-articles/search?${params}`);

      if (!response.ok) {
        throw new Error('Error al buscar artículos');
      }

      const data = await response.json();
      setResults(data.data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced search
    timeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 500);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Buscar en Base de Conocimientos
        </CardTitle>
        <CardDescription>
          Busca artículos que puedan ayudarte a resolver tu problema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="py-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!isSearching && hasSearched && results.length === 0 && (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              No se encontraron artículos para tu búsqueda
            </p>
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <div className="space-y-3">
            {results.map(({ article, relevanceScore }) => (
              <div
                key={article.id}
                className="border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => onArticleClick(article.id)}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm leading-tight flex-1">
                      {article.title}
                    </h4>
                    {relevanceScore > 0.7 && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Alta relevancia
                      </Badge>
                    )}
                  </div>

                  {article.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {article.summary}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      <span>{article.helpfulVotes} útiles</span>
                    </div>
                    {article.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {article.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
