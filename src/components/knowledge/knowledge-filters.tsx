'use client'

import { Search, RefreshCw, X, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface FamilyOption {
  id: string
  name: string
  code: string
  color?: string | null
  isOwnFamily?: boolean
}

interface KnowledgeFiltersProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  categoryFilter: string
  setCategoryFilter: (category: string) => void
  sortBy: 'recent' | 'views' | 'helpful'
  setSortBy: (sort: 'recent' | 'views' | 'helpful') => void
  familyFilter?: string
  setFamilyFilter?: (family: string) => void
  onRefresh: () => void
  onClearFilters: () => void
  categories: Array<{ id: string; name: string; color?: string | null }>
  families?: FamilyOption[]
  loading?: boolean
}

export function KnowledgeFilters({
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  sortBy,
  setSortBy,
  familyFilter = 'all',
  setFamilyFilter,
  onRefresh,
  onClearFilters,
  categories,
  families = [],
  loading = false,
}: KnowledgeFiltersProps) {
  const hasActiveFilters =
    searchTerm !== '' ||
    categoryFilter !== 'all' ||
    sortBy !== 'recent' ||
    familyFilter !== 'all'

  const activeFiltersCount = [
    searchTerm !== '',
    categoryFilter !== 'all',
    sortBy !== 'recent',
    familyFilter !== 'all',
  ].filter(Boolean).length

  const showFamilyFilter = families.length > 1 && !!setFamilyFilter

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col space-y-4">

          {/* Chips de familia — solo si hay más de una */}
          {showFamilyFilter && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5 flex-shrink-0">
                <Users className="h-3.5 w-3.5" />
                Área:
              </span>
              <button
                onClick={() => setFamilyFilter!('all')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  familyFilter === 'all'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                Todas
              </button>
              {families.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFamilyFilter!(f.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    familyFilter === f.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {f.color && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: f.color }}
                    />
                  )}
                  {f.name}
                  {f.isOwnFamily && (
                    <Badge variant="secondary" className="text-xs px-1 py-0 ml-0.5">
                      Mi área
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Búsqueda y acciones */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar artículos por título, contenido o tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                className="whitespace-nowrap"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>

              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearFilters}
                  className="whitespace-nowrap"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Categoría y ordenamiento */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center space-x-2">
                        {category.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                        )}
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Más recientes</SelectItem>
                  <SelectItem value="views">Más vistos</SelectItem>
                  <SelectItem value="helpful">Más útiles</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
