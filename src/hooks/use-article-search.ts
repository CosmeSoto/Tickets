import { useState, useEffect, useCallback } from 'react'
import { useKnowledge, Article, SearchFilters } from './use-knowledge'

export function useArticleSearch(initialQuery: string = '') {
  const { searchArticles, loading, error } = useKnowledge()
  const [query, setQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)
  const [results, setResults] = useState<Article[]>([])
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: 'recent',
    page: 1,
    limit: 20,
  })

  // Debounce del query de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Ejecutar búsqueda cuando cambia el query o los filtros
  useEffect(() => {
    const performSearch = async () => {
      const searchFilters: SearchFilters = {
        ...filters,
        search: debouncedQuery || undefined,
      }

      const articles = await searchArticles(searchFilters)
      setResults(articles)
    }

    performSearch()
  }, [debouncedQuery, filters, searchArticles])

  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1, // Reset page cuando cambian filtros
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      sortBy: 'recent',
      page: 1,
      limit: 20,
    })
    setQuery('')
  }, [])

  const loadMore = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      page: (prev.page || 1) + 1,
    }))
  }, [])

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    filters,
    setFilters: updateFilters,
    clearFilters,
    loadMore,
  }
}
