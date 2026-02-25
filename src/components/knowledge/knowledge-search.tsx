'use client'

import { useState, useEffect } from 'react'
import { Article } from '@/hooks/use-knowledge'
import { useArticleSearch } from '@/hooks/use-article-search'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, Filter, Loader2 } from 'lucide-react'
import { ArticleCard } from './article-card'
import { useCategoriesData } from '@/hooks/use-categories'

interface KnowledgeSearchProps {
  onArticleSelect?: (article: Article) => void
  categoryId?: string
  showFilters?: boolean
  placeholder?: string
  maxResults?: number
}

export function KnowledgeSearch({
  onArticleSelect,
  categoryId,
  showFilters = true,
  placeholder = 'Buscar artículos...',
  maxResults = 10,
}: KnowledgeSearchProps) {
  const { categories } = useCategoriesData()
  const {
    query,
    setQuery,
    results,
    loading,
    filters,
    setFilters,
    clearFilters,
  } = useArticleSearch()

  const [showResults, setShowResults] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Aplicar categoryId inicial si se proporciona
  useEffect(() => {
    if (categoryId) {
      setFilters({ categoryId })
    }
  }, [categoryId, setFilters])

  // Obtener tags únicos de los resultados
  const availableTags = Array.from(
    new Set(results.flatMap(article => article.tags))
  ).slice(0, 20)

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag]
    
    setSelectedTags(newTags)
    setFilters({ tags: newTags.length > 0 ? newTags : undefined })
  }

  const handleClearAll = () => {
    setQuery('')
    setSelectedTags([])
    clearFilters()
  }

  const displayedResults = results.slice(0, maxResults)

  return (
    <div className="relative space-y-4">
      {/* Barra de búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => setShowResults(true)}
            placeholder={placeholder}
            className="pl-10 pr-10"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {(query || selectedTags.length > 0 || filters.categoryId) && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleClearAll}
            title="Limpiar filtros"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          {/* Filtro de categoría */}
          {!categoryId && (
            <Select
              value={filters.categoryId || 'all'}
              onValueChange={(value) =>
                setFilters({ categoryId: value === 'all' ? undefined : value })
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Filtro de ordenamiento */}
          <Select
            value={filters.sortBy || 'recent'}
            onValueChange={(value: any) => setFilters({ sortBy: value })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Más recientes</SelectItem>
              <SelectItem value="helpful">Más útiles</SelectItem>
              <SelectItem value="views">Más vistos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tags disponibles */}
      {availableTags.length > 0 && showFilters && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Tags:</span>
          {availableTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => handleTagToggle(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Resultados */}
      {showResults && (query || selectedTags.length > 0) && (
        <div className="space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && displayedResults.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No se encontraron artículos</p>
              <p className="text-sm mt-2">
                Intenta con otros términos de búsqueda
              </p>
            </div>
          )}

          {!loading && displayedResults.length > 0 && (
            <>
              <div className="text-sm text-muted-foreground">
                {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
                {results.length > maxResults && ` (mostrando ${maxResults})`}
              </div>

              <div className="space-y-3">
                {displayedResults.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onClick={() => {
                      onArticleSelect?.(article)
                      setShowResults(false)
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
