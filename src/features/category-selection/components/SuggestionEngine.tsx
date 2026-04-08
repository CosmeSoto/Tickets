'use client';

import React from 'react';
import { Lightbulb, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  const getRelevanceColor = (score: number) => {
    if (score >= 0.7) return 'text-green-600 dark:text-green-400';
    if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  const getRelevanceLabel = (score: number) => {
    if (score >= 0.7) return 'Alta';
    if (score >= 0.5) return 'Media';
    return 'Baja';
  };

  const renderPath = (path: Suggestion['path']) =>
    path.map((cat) => cat.name).join(' > ');

  if (!hasContent) return null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0" />
          Categorías Sugeridas
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-3">
        {isAnalyzing && (
          <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
            <div className="animate-pulse flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>Analizando tu descripción...</span>
            </div>
          </div>
        )}

        {!isAnalyzing && displayedSuggestions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-4 text-center gap-1">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No se encontraron sugerencias relevantes</p>
            <p className="text-xs text-muted-foreground">Usa la búsqueda o navegación manual</p>
          </div>
        )}

        {!isAnalyzing && displayedSuggestions.length > 0 && (
          <div className="space-y-2">
            {displayedSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.category.id}
                type="button"
                onClick={() => onSuggestionSelect(suggestion.category.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md border transition-all',
                  'hover:border-primary hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1'
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Left: color dot + name + path */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: suggestion.category.color }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-sm truncate">
                        {suggestion.category.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn('ml-1 text-xs px-1.5 py-0 flex-shrink-0', getRelevanceColor(suggestion.relevanceScore))}
                      >
                        {getRelevanceLabel(suggestion.relevanceScore)}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground truncate">
                      {renderPath(suggestion.path)}
                    </p>

                    {suggestion.category.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {suggestion.category.description}
                      </p>
                    )}

                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">Coincidencias:</span>
                      {suggestion.matchedKeywords.slice(0, 3).map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-xs px-1.5 py-0">
                          {kw}
                        </Badge>
                      ))}
                      {suggestion.matchedKeywords.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{suggestion.matchedKeywords.length - 3}
                        </span>
                      )}
                    </div>

                    {suggestion.reason && (
                      <p className="text-xs text-muted-foreground italic mt-0.5 truncate">
                        {suggestion.reason}
                      </p>
                    )}
                  </div>

                  {/* Right: rank + score */}
                  <div className="flex flex-col items-center gap-0 flex-shrink-0 w-8 text-center">
                    <span className="text-lg font-bold text-muted-foreground leading-none">
                      {index + 1}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(suggestion.relevanceScore * 100)}%
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!isAnalyzing && suggestions.length > maxSuggestions && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Mostrando {maxSuggestions} de {suggestions.length} sugerencias
          </p>
        )}
      </CardContent>
    </Card>
  );
}
