'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Category } from '../types';

export interface StepByStepNavigatorProps {
  categories: Category[];
  currentLevel: number;
  selectedPath: string[];
  onNext: (categoryId: string) => void;
  onBack: () => void;
  onComplete: () => void;
}

interface NavigationStep {
  level: number;
  title: string;
  availableCategories: Category[];
  selectedCategory?: Category;
  canProceed: boolean;
}

/**
 * StepByStepNavigator - Navegación guiada paso a paso por niveles
 * 
 * Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.1, 8.4, 8.5, 8.6, 9.3, 9.4
 */
export function StepByStepNavigator({
  categories,
  currentLevel,
  selectedPath,
  onNext,
  onBack,
  onComplete,
}: StepByStepNavigatorProps) {
  const maxLevel = 4;

  // Get categories for current level
  const getCurrentLevelCategories = (): Category[] => {
    if (currentLevel === 1) {
      return categories.filter((c) => c.level === 1 && !c.parentId);
    }

    const parentId = selectedPath[currentLevel - 2];
    if (!parentId) return [];

    return categories.filter((c) => c.level === currentLevel && c.parentId === parentId);
  };

  const currentCategories = getCurrentLevelCategories();
  const selectedCategoryId = selectedPath[currentLevel - 1];
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  // Check if selected category has children
  const hasChildren = selectedCategory
    ? categories.some((c) => c.parentId === selectedCategory.id)
    : false;

  const canProceed = !!selectedCategory && hasChildren;
  const isLastLevel = currentLevel === maxLevel || !hasChildren;

  const progress = (currentLevel / maxLevel) * 100;

  const getLevelTitle = (level: number): string => {
    const titles = [
      'Categoría Principal',
      'Subcategoría',
      'Especialidad',
      'Detalle',
    ];
    return titles[level - 1] || `Nivel ${level}`;
  };

  const handleSelectCategory = (categoryId: string) => {
    onNext(categoryId);
  };

  const handleComplete = () => {
    if (selectedCategory) {
      onComplete();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-lg">
            Paso {currentLevel} de {maxLevel}
          </CardTitle>
          <Badge variant="outline">
            {getLevelTitle(currentLevel)}
          </Badge>
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current step title */}
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground mb-1">
            Selecciona {getLevelTitle(currentLevel).toLowerCase()}:
          </h3>
        </div>

        {/* Category selection */}
        <div 
          className="space-y-2 max-h-96 overflow-y-auto"
          role="radiogroup"
          aria-label={`Seleccionar ${getLevelTitle(currentLevel).toLowerCase()}`}
        >
          {currentCategories.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No hay categorías disponibles en este nivel
            </div>
          )}

          {currentCategories.map((category) => {
            const isSelected = category.id === selectedCategoryId;
            const childrenCount = categories.filter(
              (c) => c.parentId === category.id
            ).length;

            return (
              <button
                key={category.id}
                onClick={() => handleSelectCategory(category.id)}
                className={cn(
                  'w-full text-left p-4 rounded-lg border-2 transition-all',
                  'hover:border-primary hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  isSelected && 'border-primary bg-primary/10'
                )}
                aria-label={`${category.name}${
                  category.description ? `: ${category.description}` : ''
                }${childrenCount > 0 ? `, ${childrenCount} subcategorías` : ''}`}
                aria-pressed={isSelected}
                role="radio"
                aria-checked={isSelected}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: category.color }}
                    aria-hidden="true"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">
                        {category.name}
                      </h4>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>

                    {category.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {category.description}
                      </p>
                    )}

                    {childrenCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {childrenCount} subcategoría{childrenCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={currentLevel === 1}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          {!isLastLevel && canProceed && (
            <Button
              type="button"
              onClick={() => {
                // The onNext was already called when selecting, just move forward
              }}
              className="gap-2"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {isLastLevel && selectedCategory && (
            <Button
              type="button"
              onClick={handleComplete}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4" />
              Confirmar Selección
            </Button>
          )}

          {!selectedCategory && (
            <Button type="button" disabled className="gap-2">
              Selecciona una opción
            </Button>
          )}
        </div>

        {/* Selected path preview */}
        {selectedPath.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              Ruta seleccionada:
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedPath.map((id, index) => {
                const cat = categories.find((c) => c.id === id);
                if (!cat) return null;

                return (
                  <React.Fragment key={id}>
                    {index > 0 && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <Badge
                      variant={index === selectedPath.length - 1 ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {cat.name}
                    </Badge>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
