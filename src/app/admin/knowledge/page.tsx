'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  BookOpen, 
  Eye, 
  ThumbsUp, 
  FileText,
  Lightbulb
} from 'lucide-react'

// Componentes estandarizados
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { KnowledgeFilters } from '@/components/knowledge/knowledge-filters'
import { createKnowledgeColumns } from '@/components/knowledge/knowledge-columns'
import { KnowledgeCard } from '@/components/knowledge/knowledge-card'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Hooks y tipos
import { useModuleData } from '@/hooks/common/use-module-data'
import { useKnowledgeFilters } from '@/hooks/common/use-knowledge-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import type { Article } from '@/hooks/use-knowledge'

// Función para filtrar artículos
function filterArticles(articles: Article[], filters: any) {
  return articles.filter(article => {
    // Búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        article.title.toLowerCase().includes(searchLower) ||
        (article.summary && article.summary.toLowerCase().includes(searchLower)) ||
        (article.content && article.content.toLowerCase().includes(searchLower)) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        (article.author?.name && article.author.name.toLowerCase().includes(searchLower))
      
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

export default function AdminKnowledgePage() {
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
    return {
      total: allArticles.length,
      published: allArticles.filter(a => a.isPublished).length,
      drafts: allArticles.filter(a => !a.isPublished).length,
      totalViews: allArticles.reduce((sum, a) => sum + a.views, 0),
      totalHelpful: allArticles.reduce((sum, a) => sum + a.helpfulVotes, 0),
      avgHelpful: allArticles.length > 0
        ? Math.round(
            allArticles.reduce((sum, a) => {
              const total = a.helpfulVotes + a.notHelpfulVotes
              return sum + (total > 0 ? (a.helpfulVotes / total) * 100 : 0)
            }, 0) / allArticles.length
          )
        : 0,
    }
  }, [allArticles])

  // Handlers
  const handleViewArticle = (article: Article) => {
    router.push(`/admin/knowledge/${article.id}`)
  }

  const handleDeleteArticle = (article: Article) => {
    // TODO: Implementar confirmación y eliminación
    console.log('Delete article:', article.id)
  }

  // Configuración de paginación
  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: processedArticles.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <ModuleLayout
      title='Gestión de Conocimientos'
      subtitle='Administrar artículos de la base de conocimientos'
      loading={loading && allArticles.length === 0}
      error={error}
      onRetry={reload}
    >
      <div className="space-y-6">
        <BackToTickets />
        {/* Nota informativa */}
        <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  ¿Cómo crear artículos?
                </p>
                <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                  Los artículos se crean automáticamente desde tickets resueltos. 
                  Ve a un ticket con estado "Resuelto" y haz clic en "Crear Artículo".
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel de Estadísticas con Tema ADMIN */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <SymmetricStatsCard
            title="Total Artículos"
            value={stats.total}
            icon={BookOpen}
            color="blue"
            role="ADMIN"
          />
          
          <SymmetricStatsCard
            title="Publicados"
            value={stats.published}
            icon={FileText}
            color="green"
            role="ADMIN"
            badge={stats.total > 0 ? {
              text: `${Math.round((stats.published / stats.total) * 100)}%`,
              variant: 'secondary'
            } : undefined}
            status="success"
          />
          
          <SymmetricStatsCard
            title="Total Vistas"
            value={stats.totalViews}
            icon={Eye}
            color="purple"
            role="ADMIN"
          />
          
          <SymmetricStatsCard
            title="Valoración"
            value={`${stats.avgHelpful}%`}
            icon={ThumbsUp}
            color="yellow"
            role="ADMIN"
            status={stats.avgHelpful >= 80 ? 'success' : stats.avgHelpful >= 60 ? 'normal' : 'warning'}
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
          description={`Gestión completa de artículos (${processedArticles.length} artículos)`}
          data={pagination.currentItems}
          columns={createKnowledgeColumns({
            onView: handleViewArticle,
            onDelete: handleDeleteArticle,
            currentUserId: undefined, // Admin puede eliminar todos
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
              onDelete={handleDeleteArticle}
              canEdit={false}
              canDelete={true}
            />
          )}
          emptyState={{
            icon: <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
            title: hasActiveFilters ? "No se encontraron artículos" : "No hay artículos disponibles",
            description: hasActiveFilters
              ? "Intenta ajustar los filtros de búsqueda"
              : "Los artículos se crean desde tickets resueltos. Ve a un ticket resuelto y haz clic en 'Crear Artículo'."
          }}
        />
      </div>
    </ModuleLayout>
  )
}
