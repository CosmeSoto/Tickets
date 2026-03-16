/**
 * Fallback Category Selector for unsupported browsers
 * 
 * Provides a simple, accessible category selection interface
 * for browsers that don't support modern features
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { InfoIcon, X } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description: string | null;
  level: number;
  parentId: string | null;
  color: string;
  isActive: boolean;
}

interface CategorySelectorFallbackProps {
  value?: string;
  onChange: (categoryId: string) => void;
  categories: Category[];
  error?: string;
  disabled?: boolean;
}

/**
 * Simple cascading category selector for fallback mode
 */
export function CategorySelectorFallback({
  value,
  onChange,
  categories,
  error,
  disabled = false,
}: CategorySelectorFallbackProps) {
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<{
    level1: Category[];
    level2: Category[];
    level3: Category[];
    level4: Category[];
  }>({
    level1: [],
    level2: [],
    level3: [],
    level4: [],
  });

  // Initialize categories by level
  useEffect(() => {
    const level1 = categories.filter(c => c.level === 1 && c.isActive);
    setAvailableCategories(prev => ({ ...prev, level1 }));
  }, [categories]);

  // Update selected path when value changes externally
  useEffect(() => {
    if (value && categories.length > 0) {
      const path = buildCategoryPath(value, categories);
      setSelectedPath(path);
      updateAvailableCategories(path);
    }
  }, [value, categories]);

  // Build category path from leaf to root
  const buildCategoryPath = (categoryId: string, allCategories: Category[]): string[] => {
    const path: string[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      path.unshift(currentId);
      const category = allCategories.find(c => c.id === currentId);
      currentId = category?.parentId || null;
    }

    return path;
  };

  // Update available categories based on selected path
  const updateAvailableCategories = (path: string[]) => {
    const newAvailable = { ...availableCategories };

    // Level 2: children of level 1 selection
    if (path[0]) {
      newAvailable.level2 = categories.filter(
        c => c.level === 2 && c.parentId === path[0] && c.isActive
      );
    } else {
      newAvailable.level2 = [];
    }

    // Level 3: children of level 2 selection
    if (path[1]) {
      newAvailable.level3 = categories.filter(
        c => c.level === 3 && c.parentId === path[1] && c.isActive
      );
    } else {
      newAvailable.level3 = [];
    }

    // Level 4: children of level 3 selection
    if (path[2]) {
      newAvailable.level4 = categories.filter(
        c => c.level === 4 && c.parentId === path[2] && c.isActive
      );
    } else {
      newAvailable.level4 = [];
    }

    setAvailableCategories(newAvailable);
  };

  // Handle selection at a specific level
  const handleLevelChange = (level: number, categoryId: string) => {
    const newPath = [...selectedPath];
    newPath[level - 1] = categoryId;
    
    // Clear selections below this level
    newPath.splice(level);
    
    setSelectedPath(newPath);
    updateAvailableCategories(newPath);

    // Find if this category has children
    const hasChildren = categories.some(
      c => c.parentId === categoryId && c.isActive
    );

    // If no children, this is the final selection
    if (!hasChildren) {
      onChange(categoryId);
    }
  };

  // Get category by ID
  const getCategoryById = (id: string): Category | undefined => {
    return categories.find(c => c.id === id);
  };

  // Get display path
  const getDisplayPath = (): string => {
    return selectedPath
      .map(id => getCategoryById(id)?.name)
      .filter(Boolean)
      .join(' > ');
  };

  return (
    <div className="space-y-4">
      {/* Info alert about fallback mode */}
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          Modo de compatibilidad activado. Selecciona la categoría navegando por los niveles.
        </AlertDescription>
      </Alert>

      {/* Level 1 */}
      <div className="space-y-2">
        <Label htmlFor="category-level-1">Categoría Principal</Label>
        <Select
          value={selectedPath[0] || ''}
          onValueChange={(value) => handleLevelChange(1, value)}
          disabled={disabled}
        >
          <SelectTrigger id="category-level-1">
            <SelectValue placeholder="Selecciona una categoría principal" />
          </SelectTrigger>
          <SelectContent>
            {availableCategories.level1.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedPath[0] && getCategoryById(selectedPath[0])?.description && (
          <p className="text-sm text-muted-foreground">
            {getCategoryById(selectedPath[0])?.description}
          </p>
        )}
      </div>

      {/* Level 2 */}
      {availableCategories.level2.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="category-level-2">Subcategoría</Label>
          <Select
            value={selectedPath[1] || ''}
            onValueChange={(value) => handleLevelChange(2, value)}
            disabled={disabled}
          >
            <SelectTrigger id="category-level-2">
              <SelectValue placeholder="Selecciona una subcategoría" />
            </SelectTrigger>
            <SelectContent>
              {availableCategories.level2.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPath[1] && getCategoryById(selectedPath[1])?.description && (
            <p className="text-sm text-muted-foreground">
              {getCategoryById(selectedPath[1])?.description}
            </p>
          )}
        </div>
      )}

      {/* Level 3 */}
      {availableCategories.level3.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="category-level-3">Especialidad</Label>
          <Select
            value={selectedPath[2] || ''}
            onValueChange={(value) => handleLevelChange(3, value)}
            disabled={disabled}
          >
            <SelectTrigger id="category-level-3">
              <SelectValue placeholder="Selecciona una especialidad" />
            </SelectTrigger>
            <SelectContent>
              {availableCategories.level3.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPath[2] && getCategoryById(selectedPath[2])?.description && (
            <p className="text-sm text-muted-foreground">
              {getCategoryById(selectedPath[2])?.description}
            </p>
          )}
        </div>
      )}

      {/* Level 4 */}
      {availableCategories.level4.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="category-level-4">Detalle</Label>
          <Select
            value={selectedPath[3] || ''}
            onValueChange={(value) => handleLevelChange(4, value)}
            disabled={disabled}
          >
            <SelectTrigger id="category-level-4">
              <SelectValue placeholder="Selecciona el detalle" />
            </SelectTrigger>
            <SelectContent>
              {availableCategories.level4.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPath[3] && getCategoryById(selectedPath[3])?.description && (
            <p className="text-sm text-muted-foreground">
              {getCategoryById(selectedPath[3])?.description}
            </p>
          )}
        </div>
      )}

      {/* Display selected path */}
      {selectedPath.length > 0 && (
        <div className="rounded-md bg-muted p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Categoría seleccionada:</p>
            <p className="text-sm text-muted-foreground">{getDisplayPath()}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedPath([]);
              setAvailableCategories(prev => ({
                ...prev,
                level2: [],
                level3: [],
                level4: [],
              }));
              onChange('');
            }}
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
