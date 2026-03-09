'use client';

import React from 'react';
import { Lightbulb, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Suggestion } from '../types';

export interface SuggestionEngineProps {
  title: string;
  description: string;
  onSuggestionSelect: (categoryId: string) => void;
  suggestions: Suggestion[];
  isAnalyzing: boolean;
  maxSuggestions?: number;
}

/**
 * SuggestionEngine - Motor de sugerencias contextuales de categorías
 * 
 * Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7
 */
export function SuggestionEngine({
  title,
  description,
  onSuggestionSelect,
  suggestions,
  isAnalyzing,
  maxSuggestions = 5,
}: SuggestionEngineProps) {
  const displayedSuggestions = suggestions.slice(0, maxSuggestions);
  const hasContent = title.trim() || description.trim();

  const getRelevanceColor = (score: number): string => {
    if (score >= 0.7) return 'text-green-600 dark:text-green-400';
    if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  const getRelevanceLabel = (score: number): string => {
    if (score >= 0.7) return 'Alta';
    if (score >= 0.5) return 'Media';
    return 'Baja';
  };

  const renderPath = (path: Suggestion['path']) => {
    return path.map((cat) => cat.name).join(' > ');
  };

  if (!hasContent) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Categorías Sugeridas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isAnalyzing && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="animate-pulse flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <span>Analizando tu descripción...</span>
            </div>
          </div>
        )}

        {!isAnalyzing && displayedSuggestions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-2">
              No se encontraron sugerencias relevantes
            </p>
            <p className="text-sm text-muted-foreground">
              Puedes usar la búsqueda o navegación manual para seleccionar una categoría
            </p>
          </div>
        )}

        {!isAnalyzing && displayedSuggestions.length > 0 && (
          <div className="space-y-3">
            {displayedSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.category.id}
                type="button"
                onClick={() => onSuggestionSelect(suggestion.category.id)}
                className={cn(
                  'w-full text-left p-4 rounded-lg border-2 transition-all',
                  'hover:border-primary hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: suggestion.category.color }}
                        aria-hidden="true"
                      />
                      <h4 className="font-semibold text-sm truncate">
                        {suggestion.category.name}
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn(
                          'ml-auto flex-shrink-0',
                          getRelevanceColor(suggestion.relevanceScore)
                        )}
                      >
                        {getRelevanceLabel(suggestion.relevanceScore)}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">
                      {renderPath(suggestion.path)}
                    </p>

                    {suggestion.category.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {suggestion.category.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        Coincidencias:
                      </span>
                      {suggestion.matchedKeywords.slice(0, 3).map((keyword, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-xs"
                        >
                          {keyword}
                        </Badge>
                      ))}
                      {suggestion.matchedKeywords.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{suggestion.matchedKeywords.length - 3} más
                        </span>
                      )}
                    </div>

                    {suggestion.reason && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        {suggestion.reason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="text-2xl font-bold text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.round(suggestion.relevanceScore * 100)}%
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!isAnalyzing && suggestions.length > maxSuggestions && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Mostrando las {maxSuggestions} sugerencias más relevantes de {suggestions.length}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
