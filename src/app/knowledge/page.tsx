'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  BookOpen, 
  Eye, 
  ThumbsUp, 
  FileText
} from 'lucide-react'

// Componentes estandarizados
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { KnowledgeFilters } from '@/components/knowledge/knowledge-filters'
import { createKnowledgeColumns } from '@/components/knowledge/knowledge-columns'
import { KnowledgeCard } from '@/components/knowledge/knowledge-card'

// Hooks y tipos
import { useModuleData } from '@/hooks/common/use-module-data'
import { useKnowledgeFilters } from '@/hooks/common/use-knowledge-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import type { Article } from '@/hooks/use-knowledge'

// Función para filtrar artículos
function filterArticles(articles: Article[], filters: any) {
  return articles.filter(article => {
    // Solo artículos publicados para clientes
    if (!article.isPublished) return false

    // Búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        article.title.toLowerCase().includes(searchLower) ||
        (article.summary && article.summary.toLowerCase().includes(searchLower)) ||
        (article.content && article.content.toLowerCase().includes(searchLower)) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchLower))
      
      if (!matchesSearch) return false
    }

    // Categoría
    if (filters.category !== 'all' && article.categoryId !== filters.category) {
      return false
    }

    return true
  })
}

// Función para ordenar artículos
function sortArticles(articles: Article[], sortBy: 'recent' | 'views' | 'helpful') {
  const sorted = [...articles]
  
  switch (sortBy) {
    case 'views':
      return sorted.sort((a, b) => b.views - a.views)
    case 'helpful':
      return sorted.sort((a, b) => b.helpfulVotes - a.helpfulVotes)
    case 'recent':
    default:
      return sorted.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
  }
}

export default function KnowledgePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  // Cargar TODOS los artículos UNA VEZ
  const {
    data: allArticles,
    loading,
    error,
    reload
  } = useModuleData<Article>({
    endpoint: '/api/knowledge',
    initialLoad: true
  })

  // Cargar categorías
  const { data: categories } = useModuleData<{ id: string; name: string; color: string | null }>({
    endpoint: '/api/categories?isActive=true',
    initialLoad: true
  })

  // Filtros
  const {
    filters,
    debouncedFilters,
    setFilter,
    clearFilters,
    hasActiveFilters
  } = useKnowledgeFilters()

  // Filtrar y ordenar en MEMORIA
  const processedArticles = useMemo(() => {
    const filtered = filterArticles(allArticles, debouncedFilters)
    return sortArticles(filtered, debouncedFilters.sortBy)
  }, [allArticles, debouncedFilters])

  // Paginación
  const pagination = usePagination(processedArticles, {
    pageSize: 20
  })

  // Estadísticas
  const stats = useMemo(() => {
    const publishedArticles = allArticles.filter(a => a.isPublished)
    
    return {
      total: publishedArticles.length,
      totalViews: publishedArticles.reduce((sum, a) => sum + a.views, 0),
      totalHelpful: publishedArticles.reduce((sum, a) => sum + a.helpfulVotes, 0),
      avgHelpful: publishedArticles.length > 0
        ? Math.round(
            publishedArticles.reduce((sum, a) => {
              const total = a.helpfulVotes + a.notHelpfulVotes
              return sum + (total > 0 ? (a.helpfulVotes / total) * 100 : 0)
            }, 0) / publishedArticles.length
          )
        : 0,
    }
  }, [allArticles])

  // Handlers
  const handleViewArticle = (article: Article) => {
    router.push(`/knowledge/${article.id}`)
  }

  // Configuración de paginación
  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: processedArticles.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session) {
    return null
  }

  return (
    <ModuleLayout
      title='Base de Conocimientos'
      subtitle='Encuentra soluciones a problemas comunes'
      loading={loading && allArticles.length === 0}
      error={error}
      onRetry={reload}
    >
      <div className="space-y-6">
        <BackToTickets />
        {/* Panel de Estadísticas con Tema CLIENT */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <SymmetricStatsCard
            title="Artículos Disponibles"
            value={stats.total}
            icon={BookOpen}
            color="blue"
            role="CLIENT"
          />
          
          <SymmetricStatsCard
            title="Artículos Útiles"
            value={stats.totalHelpful}
            icon={ThumbsUp}
            color="green"
            role="CLIENT"
            status="success"
          />
          
          <SymmetricStatsCard
            title="Total Vistas"
            value={stats.totalViews}
            icon={Eye}
            color="purple"
            role="CLIENT"
          />
          
          <SymmetricStatsCard
            title="Valoración"
            value={`${stats.avgHelpful}%`}
            icon={FileText}
            color="yellow"
            role="CLIENT"
            status={stats.avgHelpful >= 80 ? 'success' : 'normal'}
          />
        </div>

        {/* Filtros */}
        <KnowledgeFilters
          searchTerm={filters.search}
          setSearchTerm={(term) => setFilter('search', term)}
          categoryFilter={filters.category}
          setCategoryFilter={(category) => setFilter('category', category)}
          sortBy={filters.sortBy}
          setSortBy={(sort) => setFilter('sortBy', sort)}
          onRefresh={reload}
          onClearFilters={clearFilters}
          categories={categories}
          loading={loading}
        />

        {/* DataTable */}
        <DataTable
          title="Artículos de Conocimiento"
          description={`Busca soluciones antes de crear un ticket (${processedArticles.length} artículos)`}
          data={pagination.currentItems}
          columns={createKnowledgeColumns({
            onView: handleViewArticle,
          })}
          loading={loading}
          pagination={paginationConfig}
          onRefresh={reload}
          externalSearch={true}
          hideInternalFilters={true}
          onRowClick={handleViewArticle}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          cardRenderer={(article) => (
            <KnowledgeCard
              article={article}
              onView={handleViewArticle}
              canEdit={false}
              canDelete={false}
            />
          )}
          emptyState={{
            icon: <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
            title: hasActiveFilters ? "No se encontraron artículos" : "No hay artículos disponibles",
            description: hasActiveFilters
              ? "Intenta ajustar los filtros de búsqueda"
              : "Aún no hay artículos publicados en la base de conocimientos",
          }}
        />
      </div>
    </ModuleLayout>
  )
}
