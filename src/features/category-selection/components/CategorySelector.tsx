'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, CheckCircle2, Info, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Import sub-components
import { SearchBar } from './SearchBar';
import { SuggestionEngine } from './SuggestionEngine';
import { CategoryTree } from './CategoryTree';
import { StepByStepNavigator } from './StepByStepNavigator';
import { FrequentCategories } from './FrequentCategories';
import { ConfirmationPanel } from './ConfirmationPanel';
import { RelatedArticles } from './RelatedArticles';
import { KnowledgeBaseSearch } from './KnowledgeBaseSearch';

// Import hooks
import { useCategorySearch } from '../hooks/useCategorySearch';
import { useCategorySuggestions } from '../hooks/useCategorySuggestions';
import { useFrequentCategories } from '../hooks/useFrequentCategories';

// Import types
import type { Category, CategoryMetadata, SearchResult } from '../types';

/**
 * Props para el componente CategorySelector
 * 
 * @property {string} [value] - ID de la categoría actualmente seleccionada
 * @property {function} onChange - Callback que se ejecuta cuando se selecciona una categoría
 * @property {string} [ticketTitle] - Título del ticket para generar sugerencias contextuales
 * @property {string} [ticketDescription] - Descripción del ticket para generar sugerencias contextuales
 * @property {string} clientId - ID del cliente para obtener categorías frecuentes
 * @property {Category[]} categories - Lista de todas las categorías activas disponibles
 * @property {string} [error] - Mensaje de error a mostrar
 * @property {boolean} [disabled=false] - Si el selector está deshabilitado
 * @property {string} [className] - Clases CSS adicionales para el contenedor
 */
export interface CategorySelectorProps {
  value?: string;
  onChange: (categoryId: string) => void;
  ticketTitle?: string;
  ticketDescription?: string;
  clientId: string;
  categories: Category[];
  error?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Estado interno del componente CategorySelector
 * 
 * @property {string[]} selectedPath - Array de IDs de categorías desde nivel 1 hasta la seleccionada
 * @property {'full' | 'stepByStep'} mode - Modo de navegación actual
 * @property {string} searchQuery - Query de búsqueda actual
 * @property {boolean} showConfirmation - Si se está mostrando el panel de confirmación
 * @property {number | null} selectionStartTime - Timestamp de cuando se inició la selección (para analytics)
 * @property {string | null} interactionMethod - Método usado para seleccionar la categoría
 */
interface CategorySelectorState {
  selectedPath: string[];
  mode: 'full' | 'stepByStep';
  searchQuery: string;
  showConfirmation: boolean;
  selectionStartTime: number | null;
  interactionMethod: 'search' | 'suggestion' | 'manual' | 'frequent' | 'article' | null;
}

/**
 * CategorySelector - Componente principal de selección de categorías mejorado
 * 
 * Este componente orquesta todos los sub-componentes y funcionalidades del sistema
 * de selección de categorías, incluyendo:
 * 
 * - Búsqueda inteligente con fuzzy matching
 * - Sugerencias contextuales basadas en el contenido del ticket
 * - Categorías frecuentes del usuario
 * - Navegación visual mejorada (árbol completo o paso a paso)
 * - Panel de confirmación con metadata de la categoría
 * - Integración con base de conocimientos
 * - Analytics de interacciones del usuario
 * - Accesibilidad completa (WCAG 2.1 AA)
 * 
 * @component
 * @example
 * ```tsx
 * <CategorySelector
 *   value={selectedCategoryId}
 *   onChange={setCategoryId}
 *   ticketTitle="No puedo imprimir"
 *   ticketDescription="La impresora no responde"
 *   clientId="user-123"
 *   categories={allCategories}
 *   error={validationError}
 * />
 * ```
 * 
 * @remarks
 * El componente maneja automáticamente:
 * - Construcción de paths jerárquicos de categorías
 * - Cálculo de score de confianza de la selección
 * - Tracking de analytics de interacciones
 * - Anuncios para lectores de pantalla
 * - Atajos de teclado (Ctrl+K para búsqueda, Escape para cancelar)
 * 
 * @see {@link CategorySelectorProps} para detalles de las props
 * @see {@link useCategorySearch} para la lógica de búsqueda
 * @see {@link useCategorySuggestions} para la lógica de sugerencias
 * @see {@link useFrequentCategories} para categorías frecuentes
 * 
 * Requisitos implementados: 11.1, 11.2, 11.6, 6.3, 6.7, 6.8, 6.10, 10.1-10.5, 8.1-8.7, 9.3-9.4
 */
export function CategorySelector({
  value,
  onChange,
  ticketTitle = '',
  ticketDescription = '',
  clientId,
  categories,
  error,
  disabled = false,
  className,
}: CategorySelectorProps) {
  // State management
  const [state, setState] = useState<CategorySelectorState>({
    selectedPath: [],
    mode: 'full',
    searchQuery: '',
    showConfirmation: false,
    selectionStartTime: null,
    interactionMethod: null,
  });

  const [categoryMetadata, setCategoryMetadata] = useState<CategoryMetadata | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const hasTrackedSelection = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [announcement, setAnnouncement] = useState<string>('');

  // Initialize selection start time
  useEffect(() => {
    if (!state.selectionStartTime) {
      setState((prev) => ({ ...prev, selectionStartTime: Date.now() }));
    }
  }, [state.selectionStartTime]);

  // Keyboard shortcuts - Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      
      // Escape to clear selection and go back to selection mode
      if (e.key === 'Escape' && state.showConfirmation) {
        e.preventDefault();
        handleEditSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.showConfirmation]);

  // Custom hooks
  const { search, isSearching } = useCategorySearch({
    categories,
    threshold: 0.3,
    maxResults: 10,
  });

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const { suggestions, isAnalyzing } = useCategorySuggestions({
    categories,
    title: ticketTitle,
    description: ticketDescription,
    debounceMs: 500,
  });

  const { frequentCategories, isLoading: isLoadingFrequent } = useFrequentCategories({
    clientId,
    limit: 5,
  });

  // Build category path from selected category ID
  const buildCategoryPath = useCallback(
    (categoryId: string): string[] => {
      const path: string[] = [];
      let currentId: string | null = categoryId;

      while (currentId) {
        path.unshift(currentId);
        const category = categories.find((c) => c.id === currentId);
        currentId = category?.parentId || null;
      }

      return path;
    },
    [categories]
  );

  // Get selected category
  const selectedCategory = value
    ? categories.find((c) => c.id === value)
    : null;

  // Update selected path when value changes
  useEffect(() => {
    if (value) {
      const path = buildCategoryPath(value);
      setState((prev) => ({ ...prev, selectedPath: path }));
    } else {
      setState((prev) => ({ ...prev, selectedPath: [] }));
    }
  }, [value, buildCategoryPath]);

  // Fetch category metadata when selection changes
  useEffect(() => {
    if (selectedCategory) {
      fetchCategoryMetadata(selectedCategory.id);
      calculateConfidenceScore(selectedCategory);
    } else {
      setCategoryMetadata(null);
      setConfidenceScore(0);
    }
  }, [selectedCategory, ticketTitle, ticketDescription]);

  // Fetch category metadata from API
  const fetchCategoryMetadata = async (categoryId: string) => {
    try {
      const response = await fetch(`/api/categories/metadata/${categoryId}`);
      if (response.ok) {
        const data = await response.json();
        setCategoryMetadata(data.data);
      }
    } catch (error) {
      console.error('Error fetching category metadata:', error);
    }
  };

  // Calculate confidence score based on text matching
  const calculateConfidenceScore = (category: Category) => {
    const text = `${ticketTitle} ${ticketDescription}`.toLowerCase();
    const categoryText = `${category.name} ${category.description || ''}`.toLowerCase();

    if (!text.trim()) {
      setConfidenceScore(50); // Neutral score if no text
      return;
    }

    // Simple keyword matching for confidence
    const words = text.split(/\s+/).filter((w) => w.length > 3);
    const matches = words.filter((word) => categoryText.includes(word));
    const score = Math.min(100, Math.round((matches.length / Math.max(words.length, 1)) * 100));

    setConfidenceScore(score);
  };

  // Track analytics event
  const trackAnalyticsEvent = useCallback(
    async (
      eventType: 'search' | 'suggestion_click' | 'manual_select' | 'frequent_select' | 'category_change',
      categoryId?: string,
      searchQuery?: string,
      metadata?: Record<string, any>
    ) => {
      if (!state.selectionStartTime) return;

      const timeToSelect = Date.now() - state.selectionStartTime;

      try {
        await fetch('/api/analytics/category-selection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType,
            clientId,
            categoryId,
            searchQuery,
            timeToSelect,
            metadata,
          }),
        });
      } catch (error) {
        console.error('Error tracking analytics:', error);
      }
    },
    [clientId, state.selectionStartTime]
  );

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setState((prev) => ({ ...prev, searchQuery: query }));
      const results = search(query);
      setSearchResults(results);

      // Announce search results to screen readers
      if (query.length >= 2) {
        if (results.length === 0) {
          setAnnouncement(`No se encontraron resultados para "${query}"`);
          trackAnalyticsEvent('search', undefined, query, { noResults: true });
        } else {
          setAnnouncement(`Se encontraron ${results.length} resultados para "${query}"`);
        }
      }
    },
    [search, trackAnalyticsEvent]
  );

  // Handle category selection
  const handleCategorySelect = useCallback(
    (categoryId: string, method: CategorySelectorState['interactionMethod']) => {
      const category = categories.find((c) => c.id === categoryId);
      
      // Announce selection to screen readers
      if (category) {
        const path = buildCategoryPath(categoryId);
        const pathNames = path
          .map((id) => categories.find((c) => c.id === id)?.name)
          .filter(Boolean)
          .join(', ');
        setAnnouncement(`Categoría seleccionada: ${pathNames}`);
      }

      // Track if this is a change from previous selection
      if (value && value !== categoryId) {
        trackAnalyticsEvent('category_change', categoryId, undefined, {
          previousCategory: value,
          method,
        });
      }

      // Track selection method
      if (method && !hasTrackedSelection.current) {
        const eventType =
          method === 'search'
            ? 'search'
            : method === 'suggestion'
            ? 'suggestion_click'
            : method === 'frequent'
            ? 'frequent_select'
            : 'manual_select';

        trackAnalyticsEvent(eventType, categoryId);
        hasTrackedSelection.current = true;
      }

      setState((prev) => ({
        ...prev,
        interactionMethod: method,
        showConfirmation: true,
      }));

      onChange(categoryId);
    },
    [value, onChange, trackAnalyticsEvent, categories, buildCategoryPath]
  );

  // Handle search result selection
  const handleSearchResultSelect = useCallback(
    (categoryId: string) => {
      handleCategorySelect(categoryId, 'search');
    },
    [handleCategorySelect]
  );

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (categoryId: string) => {
      handleCategorySelect(categoryId, 'suggestion');
    },
    [handleCategorySelect]
  );

  // Handle frequent category selection
  const handleFrequentSelect = useCallback(
    (categoryId: string) => {
      handleCategorySelect(categoryId, 'frequent');
    },
    [handleCategorySelect]
  );

  // Handle manual tree selection
  const handleTreeSelect = useCallback(
    (categoryId: string) => {
      handleCategorySelect(categoryId, 'manual');
    },
    [handleCategorySelect]
  );

  // Handle article-based selection
  const handleArticleSelect = useCallback(
    (categoryId: string) => {
      handleCategorySelect(categoryId, 'article');
    },
    [handleCategorySelect]
  );

  // Handle mode toggle
  const handleModeToggle = (mode: 'full' | 'stepByStep') => {
    setState((prev) => ({ ...prev, mode }));
  };

  // Handle edit selection
  const handleEditSelection = () => {
    setState((prev) => ({ ...prev, showConfirmation: false }));
  };

  // Get confidence indicator
  const getConfidenceIndicator = () => {
    if (confidenceScore >= 80) {
      return {
        icon: CheckCircle2,
        color: 'text-green-600',
        bgColor: 'bg-green-50 dark:bg-green-950',
        borderColor: 'border-green-200 dark:border-green-800',
        message: 'Alta confianza: Esta categoría parece muy apropiada para tu problema.',
      };
    } else if (confidenceScore >= 60) {
      return {
        icon: Info,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-950',
        borderColor: 'border-blue-200 dark:border-blue-800',
        message: 'Confianza media: Esta categoría podría ser apropiada.',
      };
    } else {
      return {
        icon: AlertCircle,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 dark:bg-amber-950',
        borderColor: 'border-amber-200 dark:border-amber-800',
        message:
          'Confianza baja: Considera revisar tu selección o usar la búsqueda para encontrar una categoría más específica.',
      };
    }
  };

  const confidenceIndicator = getConfidenceIndicator();
  const ConfidenceIcon = confidenceIndicator.icon;

  return (
    <div className={cn('space-y-3 w-full min-w-[320px]', className)}>
      {/* Screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="destructive" role="alert" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading indicator for initial load */}
      {categories.length === 0 && !error && (
        <div className="flex items-center justify-center p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Cargando categorías...</span>
          </div>
        </div>
      )}

      {/* Search bar - always visible */}
      <div className="space-y-2">
        <label htmlFor="category-search" className="text-sm font-medium">
          Buscar categoría
          <span className="text-xs text-muted-foreground ml-2">
            (Atajo: Ctrl+K)
          </span>
        </label>
        <SearchBar
          ref={searchInputRef}
          onSearch={handleSearch}
          onResultSelect={handleSearchResultSelect}
          results={searchResults}
          isLoading={isSearching}
          placeholder="Escribe palabras clave para buscar..."
        />
      </div>

      {/* Frequent categories - compact */}
      {!isLoadingFrequent && frequentCategories.length > 0 && (
        <FrequentCategories
          frequentCategories={frequentCategories}
          onSelect={handleFrequentSelect}
          isLoading={isLoadingFrequent}
          maxItems={3}
        />
      )}

      {/* Suggestions - compact */}
      {(ticketTitle || ticketDescription) && (
        <SuggestionEngine
          title={ticketTitle}
          description={ticketDescription}
          onSuggestionSelect={handleSuggestionSelect}
          suggestions={suggestions}
          isAnalyzing={isAnalyzing}
          maxSuggestions={3}
        />
      )}

      {/* Main selection area */}
      {!state.showConfirmation ? (
        <Tabs
          value={state.mode}
          onValueChange={(value) => handleModeToggle(value as 'full' | 'stepByStep')}
          className="w-full"
          aria-label="Modo de navegación de categorías"
        >
          <TabsList className="grid w-full grid-cols-2" role="tablist">
            <TabsTrigger value="full" role="tab" aria-label="Vista completa de todas las categorías" className="text-sm">
              Vista Completa
            </TabsTrigger>
            <TabsTrigger value="stepByStep" role="tab" aria-label="Navegación paso a paso guiada" className="text-sm">
              Paso a Paso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="full" className="mt-3" role="tabpanel">
            <CategoryTree
              categories={categories}
              selectedPath={state.selectedPath}
              onSelect={handleTreeSelect}
              mode="full"
            />
          </TabsContent>

          <TabsContent value="stepByStep" className="mt-3" role="tabpanel">
            <StepByStepNavigator
              categories={categories}
              currentLevel={state.selectedPath.length}
              selectedPath={state.selectedPath}
              onNext={handleTreeSelect}
              onBack={() => {
                const newPath = state.selectedPath.slice(0, -1);
                setState((prev) => ({ ...prev, selectedPath: newPath }));
                if (newPath.length > 0) {
                  onChange(newPath[newPath.length - 1]);
                }
                setAnnouncement('Retrocediendo al nivel anterior');
              }}
              onComplete={() => {
                setState((prev) => ({ ...prev, showConfirmation: true }));
                setAnnouncement('Selección completada. Revisa el resumen de tu categoría.');
              }}
            />
          </TabsContent>
        </Tabs>
      ) : selectedCategory ? (
        <section aria-label="Resumen de categoría seleccionada" className="space-y-3">
          {/* Confidence indicator - compact */}
          <Alert 
            className={cn(confidenceIndicator.bgColor, confidenceIndicator.borderColor, 'py-2')}
            role="status"
            aria-live="polite"
          >
            <ConfidenceIcon className={cn('h-4 w-4', confidenceIndicator.color)} />
            <AlertDescription className={cn(confidenceIndicator.color, 'text-sm')}>
              {confidenceIndicator.message}
            </AlertDescription>
          </Alert>

          {categoryMetadata && (
            <>
              <ConfirmationPanel
                category={selectedCategory}
                path={categories.filter((c) => state.selectedPath.includes(c.id))}
                metadata={categoryMetadata}
                onEdit={handleEditSelection}
                onConfirm={() => {
                  // Close confirmation panel and show compact summary
                  setState((prev) => ({ ...prev, showConfirmation: false }));
                  setAnnouncement(`Categoría confirmada: ${selectedCategory.name}`);
                }}
              />

              {/* Related articles - compact */}
              <RelatedArticles
                categoryId={selectedCategory.id}
                ticketTitle={ticketTitle}
                ticketDescription={ticketDescription}
                onArticleClick={(articleId: string) => {
                  trackAnalyticsEvent('search', selectedCategory.id, undefined, {
                    articleViewed: articleId,
                  });
                }}
              />

              {/* Knowledge base search - compact */}
              <KnowledgeBaseSearch
                onArticleClick={(articleId: string) => {
                  // Track article click from KB search
                  trackAnalyticsEvent('search', selectedCategory.id, undefined, {
                    kbArticleViewed: articleId,
                  });
                }}
              />
            </>
          )}
        </section>
      ) : (
        // Fallback if no category selected
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No hay categoría seleccionada. Por favor selecciona una categoría.
          </AlertDescription>
        </Alert>
      )}

      {/* Compact summary when confirmed (not in confirmation mode) */}
      {!state.showConfirmation && selectedCategory && (
        <Card className="border-green-500/30 bg-green-50/30 dark:bg-green-950/10">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Categoría seleccionada:</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {state.selectedPath
                      .map((id) => categories.find((c) => c.id === id))
                      .filter(Boolean)
                      .map((cat, index, arr) => (
                        <React.Fragment key={cat!.id}>
                          {index > 0 && (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                          <Badge
                            variant={index === arr.length - 1 ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {cat!.name}
                          </Badge>
                        </React.Fragment>
                      ))}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setState((prev) => ({ ...prev, showConfirmation: true }))}
                className="flex-shrink-0"
              >
                <Info className="h-4 w-4 mr-1" />
                Ver detalles
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
