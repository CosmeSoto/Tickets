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
import { useToast } from '@/hooks/use-toast'
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
        article.tags.some(tag => tag.toLowerCase().includes(searchLower))
      
      if (!matchesSearch) return false
    }

    // Categoría
    if (filters.category !== 'all' && article.categoryId !== filters.category) {
      return false
    }

    // Solo artículos publicados
    if (!article.isPublished) return false

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

export default function TechnicianKnowledgePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
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
      total: processedArticles.length,
      published: processedArticles.filter(a => a.isPublished).length,
      totalViews: processedArticles.reduce((sum, a) => sum + a.views, 0),
      totalHelpful: processedArticles.reduce((sum, a) => sum + a.helpfulVotes, 0),
      avgHelpful: processedArticles.length > 0
        ? Math.round(
            processedArticles.reduce((sum, a) => {
              const total = a.helpfulVotes + a.notHelpfulVotes
              return sum + (total > 0 ? (a.helpfulVotes / total) * 100 : 0)
            }, 0) / processedArticles.length
          )
        : 0,
    }
  }, [processedArticles])

  // Handlers
  const handleViewArticle = (article: Article) => {
    router.push(`/technician/knowledge/${article.id}`)
  }

  const handleDeleteArticle = async (article: Article) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este artículo?')) {
      return
    }

    try {
      const response = await fetch(`/api/knowledge/${article.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Artículo eliminado correctamente',
        })
        reload()
      } else {
        throw new Error('Error al eliminar')
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el artículo',
        variant: 'destructive',
      })
    }
  }

  // Configuración de paginación
  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: processedArticles.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session || session.user.role !== 'TECHNICIAN') {
    return null
  }

  return (
    <ModuleLayout
      title='Base de Conocimientos'
      subtitle='Artículos técnicos y guías de solución'
      loading={loading && allArticles.length === 0}
      error={error}
      onRetry={reload}
    >
      <div className="space-y-6">
        <BackToTickets />
        {/* Nota informativa */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  ¿Cómo crear artículos?
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Los artículos se crean automáticamente desde tickets resueltos. 
                  Ve a un ticket con estado "Resuelto" y haz clic en "Crear Artículo".
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel de Estadísticas */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <SymmetricStatsCard
            title="Total Artículos"
            value={stats.total}
            icon={BookOpen}
            color="blue"
          />
          
          <SymmetricStatsCard
            title="Publicados"
            value={stats.published}
            icon={FileText}
            color="green"
            badge={stats.total > 0 ? {
              text: `${Math.round((stats.published / stats.total) * 100)}%`,
              variant: 'secondary'
            } : undefined}
          />
          
          <SymmetricStatsCard
            title="Total Vistas"
            value={stats.totalViews}
            icon={Eye}
            color="purple"
          />
          
          <SymmetricStatsCard
            title="Valoración"
            value={`${stats.avgHelpful}%`}
            icon={ThumbsUp}
            color="yellow"
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
          description={`Base de conocimientos técnicos (${processedArticles.length} artículos)`}
          data={pagination.currentItems}
          columns={createKnowledgeColumns({
            onView: handleViewArticle,
            onDelete: handleDeleteArticle,
            currentUserId: session?.user?.id,
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
              canDelete={article.authorId === session?.user?.id}
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
