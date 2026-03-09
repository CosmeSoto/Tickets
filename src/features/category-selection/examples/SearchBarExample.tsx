/**
 * Ejemplo de uso del hook useCategorySearch
 * 
 * Este componente muestra cómo integrar el hook en una barra de búsqueda
 * con resultados en tiempo real y historial de búsquedas.
 */

'use client';

import { useState } from 'react';
import { useCategorySearch } from '../hooks/useCategorySearch';
import type { Category, SearchResult } from '../types';

interface SearchBarExampleProps {
  categories: Category[];
  onCategorySelect: (category: Category) => void;
}

export function SearchBarExample({ categories, onCategorySelect }: SearchBarExampleProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const { search, isSearching, searchHistory, clearHistory } = useCategorySearch({
    categories,
    threshold: 0.3,
    maxResults: 10,
  });

  const handleSearch = (value: string) => {
    setQuery(value);
    
    if (value.trim().length >= 2) {
      const searchResults = search(value);
      setResults(searchResults);
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    onCategorySelect(result.category);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    handleSearch(historyQuery);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Barra de búsqueda */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder="Buscar categoría... (ej: impresora, servidor, software)"
          className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        {isSearching && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {/* Resultados de búsqueda */}
      {showResults && results.length > 0 && (
        <div className="absolute z-10 w-full max-w-2xl mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          <div className="p-2">
            <p className="px-2 py-1 text-xs text-gray-500 font-medium">
              {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          {results.map((result) => (
            <button
              key={result.category.id}
              onClick={() => handleSelect(result)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-t border-gray-100 transition-colors"
            >
              {/* Nombre de la categoría */}
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: result.category.color }}
                />
                <span className="font-medium text-gray-900">
                  {result.category.name}
                </span>
              </div>

              {/* Path completo */}
              <div className="mt-1 text-sm text-gray-600">
                {result.path.map((cat) => cat.name).join(' > ')}
              </div>

              {/* Descripción si existe */}
              {result.category.description && (
                <div className="mt-1 text-xs text-gray-500 line-clamp-1">
                  {result.category.description}
                </div>
              )}

              {/* Metadata de búsqueda */}
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                <span>Relevancia: {Math.round(result.score * 100)}%</span>
                {result.matchedFields.length > 0 && (
                  <span>
                    Coincide en: {result.matchedFields.join(', ')}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Sin resultados */}
      {showResults && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-10 w-full max-w-2xl mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <p className="text-gray-500 text-center">
            No se encontraron categorías para "{query}"
          </p>
        </div>
      )}

      {/* Historial de búsquedas */}
      {!query && searchHistory.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              Búsquedas recientes
            </p>
            <button
              onClick={clearHistory}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Limpiar
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((historyQuery, i) => (
              <button
                key={i}
                onClick={() => handleHistoryClick(historyQuery)}
                className="px-3 py-1 text-sm bg-white border border-gray-200 rounded-full hover:bg-gray-100 hover:border-gray-300 transition-colors"
              >
                {historyQuery}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
