'use client';

import React from 'react';
import { Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { FrequentCategory } from '../types';

export interface FrequentCategoriesProps {
  frequentCategories: FrequentCategory[];
  onSelect: (categoryId: string) => void;
  isLoading: boolean;
  maxItems?: number;
}

/**
 * FrequentCategories - Muestra las categorías más usadas por el cliente
 * 
 * Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export function FrequentCategories({
  frequentCategories,
  onSelect,
  isLoading,
  maxItems = 5,
}: FrequentCategoriesProps) {
  const displayedCategories = frequentCategories.slice(0, maxItems);

  const renderPath = (path: FrequentCategory['path']) => {
    return path.map((cat) => cat.name).join(' > ');
  };

  const formatLastUsed = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    return `Hace ${Math.floor(diffDays / 30)} meses`;
  };

  // Don't show if no categories
  if (!isLoading && displayedCategories.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          Categorías Frecuentes
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tus categorías más utilizadas recientemente
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && displayedCategories.length > 0 && (
          <div className="space-y-2">
            {displayedCategories.map((frequent, index) => (
              <button
                key={frequent.category.id}
                type="button"
                onClick={() => onSelect(frequent.category.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  'hover:border-primary hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Ranking number */}
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Category name with color */}
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: frequent.category.color }}
                        aria-hidden="true"
                      />
                      <h4 className="font-semibold text-sm truncate">
                        {frequent.category.name}
                      </h4>
                    </div>

                    {/* Path */}
                    <p className="text-xs text-muted-foreground mb-2">
                      {renderPath(frequent.path)}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {frequent.usageCount} {frequent.usageCount === 1 ? 'vez' : 'veces'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatLastUsed(frequent.lastUsed)}
                      </div>
                    </div>
                  </div>

                  {/* Arrow indicator */}
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        )}

        {!isLoading && frequentCategories.length > maxItems && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Mostrando las {maxItems} categorías más frecuentes
          </p>
        )}
      </CardContent>
    </Card>
  );
}
