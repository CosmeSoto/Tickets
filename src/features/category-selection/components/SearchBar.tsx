'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SearchResult } from '../types';

export interface SearchBarProps {
  onSearch: (query: string) => void;
  onResultSelect: (categoryId: string) => void;
  results: SearchResult[];
  isLoading: boolean;
  placeholder?: string;
  debounceMs?: number;
}

/**
 * SearchBar - Componente de búsqueda con debounce y dropdown de resultados
 * 
 * Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 8.1, 8.4, 8.5, 8.6, 8.7, 9.3, 9.4
 */
export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar(
    {
      onSearch,
      onResultSelect,
      results,
      isLoading,
      placeholder = 'Buscar categoría...',
      debounceMs = 300,
    },
    forwardedRef
  ) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // Combine internal and forwarded refs
  const inputRef = forwardedRef || internalInputRef;

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        onSearch(query);
        setShowResults(true);
      }, debounceMs);
    } else {
      setShowResults(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, onSearch, debounceMs]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const currentInputRef = 'current' in inputRef ? inputRef.current : null;
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        !currentInputRef?.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputRef]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    onResultSelect(result.category.id);
    setQuery('');
    setShowResults(false);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    setQuery('');
    setShowResults(false);
    setSelectedIndex(-1);
    const currentInputRef = 'current' in inputRef ? inputRef.current : null;
    currentInputRef?.focus();
  };

  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const renderPath = (path: SearchResult['path']) => {
    return path.map((cat) => cat.name).join(' > ');
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder={placeholder}
          className="pl-10 pr-10"
          aria-label="Buscar categoría"
          aria-expanded={showResults}
          aria-controls="search-results"
          aria-activedescendant={
            selectedIndex >= 0 ? `result-${selectedIndex}` : undefined
          }
        />
        {isLoading && (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {query && !isLoading && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && query.length >= 2 && (
        <div
          ref={resultsRef}
          id="search-results"
          role="listbox"
          className="absolute z-50 w-full mt-2 bg-background border rounded-lg shadow-lg max-h-96 overflow-y-auto"
        >
          {results.length === 0 && !isLoading && (
            <div className="p-4 text-center text-muted-foreground">
              No se encontraron categorías que coincidan con "{query}"
            </div>
          )}

          {results.map((result, index) => (
            <button
              key={result.category.id}
              type="button"
              id={`result-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleSelectResult(result)}
              className={cn(
                'w-full text-left p-3 hover:bg-accent transition-colors border-b last:border-b-0',
                'min-h-[44px]', // Touch-friendly minimum height
                index === selectedIndex && 'bg-accent'
              )}
            >
              <div className="font-medium">
                {highlightMatch(result.category.name, query)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {renderPath(result.path)}
              </div>
              {result.category.description && (
                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {highlightMatch(result.category.description, query)}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: result.category.color }}
                  aria-hidden="true"
                />
                <span className="text-xs text-muted-foreground">
                  Nivel {result.category.level}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  Relevancia: {Math.round(result.score * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
