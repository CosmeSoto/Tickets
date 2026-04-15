'use client'

import { useMemo, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  BookOpen, 
  Eye, 
  ThumbsUp, 
  FileText,
  Lightbulb,
} from 'lucide-react'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { KnowledgeFilters } from '@/components/knowledge/knowledge-filters'
import { createKnowledgeColumns } from '@/components/knowledge/knowledge-columns'
import { KnowledgeCard } from '@/components/knowledge/knowledge-card'
import { Card, CardContent } from '@/components/ui/card'

import { useModuleData } from '@/hooks/common/use-module-data'
import { useKnowledgeFilters } from '@/hooks/common/use-knowledge-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import { useToast } from '@/hooks/use-toast'
import type { Article } from '@/hooks/use-knowledge'

interface FamilyOption {
  id: string
  name: string
  code: string
  color?: string | null
  isOwnFamily?: boolean
}

function filterArticles(articles: Article[], filters: any) {
  return articles.filter(article => {
    if (!article.isPublished) return false

    if (filters.search) {
      const q = filters.search.toLowerCase()
      const match =
        article.title.toLowerCase().includes(q) ||
        (article.summary?.toLowerCase().includes(q) ?? false) ||
        (article.content?.toLowerCase().includes(q) ?? false) ||
        article.tags.some(t => t.toLowerCase().includes(q))
      if (!match) return false
    }

    if (filters.category !== 'all' && article.categoryId !== filters.category) return false
    if (filters.family !== 'all' && article.familyId !== filters.family) return false

    return true
  })
}

function sortArticles(articles: Article[], sortBy: 'recent' | 'views' | 'helpful') {
  const sorted = [...articles]
  switch (sortBy) {
    case 'views': return sorted.sort((a, b) => b.views - a.views)
    case 'helpful': return sorted.sort((a, b) => b.helpfulVotes - a.helpfulVotes)
    default: return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
}

export default function TechnicianKnowledgePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [families, setFamilies] = useState<FamilyOption[]>([])

  // Cargar artículos filtrados por familia del técnico
  const { data: allArticles, loading, error, reload } = useModuleData<Article>({
    endpoint: '/api/knowledge-articles',
    initialLoad: true,
  })

  const { data: categories } = useModuleData<{ id: string; name: string; color: string | null }>({
    endpoint: '/api/categories?isActive=true',
    initialLoad: true,
  })

  // Cargar familias asignadas al técnico para los chips de filtro
  useEffect(() => {
    fetch('/api/families')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setFamilies(d.data.map((f: any) => ({
            id: f.id,
            name: f.name,
            code: f.code,
            color: f.color,
            isOwnFamily: false,
          })))
        }
      })
      .catch(() => {})
  }, [])

  const { filters, debouncedFilters, setFilter, clearFilters, hasActiveFilters } = useKnowledgeFilters()

  const processedArticles = useMemo(() => {
    const filtered = filterArticles(allArticles, debouncedFilters)
    return sortArticles(filtered, debouncedFilters.sortBy)
  }, [allArticles, debouncedFilters])

  const pagination = usePagination(processedArticles, { pageSize: 20 })

  const stats = useMemo(() => ({
    total: processedArticles.length,
    published: processedArticles.filter(a => a.isPublished).length,
    totalViews: processedArticles.reduce((sum, a) => sum + a.views, 0),
    avgHelpful: processedArticles.length > 0
      ? Math.round(
          processedArticles.reduce((sum, a) => {
            const total = a.helpfulVotes + a.notHelpfulVotes
            return sum + (total > 0 ? (a.helpfulVotes / total) * 100 : 0)
          }, 0) / processedArticles.length
        )
      : 0,
  }), [processedArticles])

  const handleViewArticle = (article: Article) => router.push(`/technician/knowledge/${article.id}`)

  const handleDeleteArticle = async (article: Article) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este artículo?')) return
    try {
      const res = await fetch(`/api/knowledge/${article.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Artículo eliminado', description: 'El artículo fue eliminado correctamente' })
        reload()
      } else {
        throw new Error()
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar el artículo', variant: 'destructive' })
    }
  }

  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: processedArticles.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session || session.user.role !== 'TECHNICIAN') return null

  return (
    <ModuleLayout
      title='Base de Conocimientos'
      subtitle='Artículos técnicos y guías de solución de tu área'
      loading={loading && allArticles.length === 0}
      error={error}
      onRetry={reload}
    >
      <div className="space-y-6">
        <BackToTickets />

        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  ¿Cómo crear artículos?
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Los artículos se crean desde tickets resueltos. Ve a un ticket con estado "Resuelto" y haz clic en "Crear Artículo". Solo ves artículos de las áreas que tienes asignadas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <SymmetricStatsCard title="Total Artículos" value={stats.total} icon={BookOpen} color="blue" />
          <SymmetricStatsCard
            title="Publicados"
            value={stats.published}
            icon={FileText}
            color="green"
            badge={stats.total > 0 ? { text: `${Math.round((stats.published / stats.total) * 100)}%`, variant: 'secondary' } : undefined}
          />
          <SymmetricStatsCard title="Total Vistas" value={stats.totalViews} icon={Eye} color="purple" />
          <SymmetricStatsCard
            title="Valoración"
            value={`${stats.avgHelpful}%`}
            icon={ThumbsUp}
            color="yellow"
            status={stats.avgHelpful >= 80 ? 'success' : 'normal'}
          />
        </div>

        <KnowledgeFilters
          searchTerm={filters.search}
          setSearchTerm={(term) => setFilter('search', term)}
          categoryFilter={filters.category}
          setCategoryFilter={(category) => setFilter('category', category)}
          sortBy={filters.sortBy}
          setSortBy={(sort) => setFilter('sortBy', sort)}
          familyFilter={filters.family}
          setFamilyFilter={(family) => setFilter('family', family)}
          onRefresh={reload}
          onClearFilters={clearFilters}
          categories={categories}
          families={families}
          loading={loading}
        />

        <DataTable
          title="Artículos de Conocimiento"
          description={`Artículos de tus áreas asignadas (${processedArticles.length} artículos)`}
          data={pagination.currentItems}
          columns={createKnowledgeColumns({
            onView: handleViewArticle,
            onDelete: handleDeleteArticle,
            currentUserId: session?.user?.id,
            showFamily: families.length > 1,
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
              : "Los artículos se crean desde tickets resueltos. Ve a un ticket resuelto y haz clic en 'Crear Artículo'.",
          }}
        />
      </div>
    </ModuleLayout>
  )
}
