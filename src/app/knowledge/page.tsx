'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  BookOpen, 
  Eye, 
  ThumbsUp, 
  FileText,
} from 'lucide-react'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
import { DataTable } from '@/components/ui/data-table'
import { ExportButton } from '@/components/common/export-button'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { KnowledgeFilters } from '@/components/knowledge/knowledge-filters'
import { createKnowledgeColumns } from '@/components/knowledge/knowledge-columns'
import { KnowledgeCard } from '@/components/knowledge/knowledge-card'

import { useModuleData } from '@/hooks/common/use-module-data'
import { useKnowledgeFilters } from '@/hooks/common/use-knowledge-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
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

export default function KnowledgePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards')
  const [families, setFamilies] = useState<FamilyOption[]>([])

  // Usa el endpoint con filtrado por rol (cliente ve solo familias de sus tickets)
  const { data: allArticles, loading, error, reload } = useModuleData<Article>({
    endpoint: '/api/knowledge-articles',
    initialLoad: true,
  })

  // Cargar familias accesibles para el usuario (para chips de filtro)
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
            isOwnFamily: f.isOwnFamily ?? false,
          })))
        }
      })
      .catch(() => {})
  }, [])

  const { filters, debouncedFilters, setFilter, clearFilters, hasActiveFilters } = useKnowledgeFilters()

  // Resetear categoría cuando cambia la familia
  const prevFamilyRef = useRef(filters.family)
  useEffect(() => {
    if (prevFamilyRef.current !== filters.family) {
      prevFamilyRef.current = filters.family
      if (filters.category !== 'all') setFilter('category', 'all')
    }
  }, [filters.family])

  // Categorías derivadas de los artículos de la familia seleccionada
  const categories = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string | null }>()
    allArticles
      .filter(a => a.isPublished && (debouncedFilters.family === 'all' || a.familyId === debouncedFilters.family))
      .forEach(a => {
        if (a.category && !seen.has(a.category.id)) {
          seen.set(a.category.id, { id: a.category.id, name: a.category.name, color: a.category.color ?? null })
        }
      })
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allArticles, debouncedFilters.family])

  const processedArticles = useMemo(() => {
    const filtered = filterArticles(allArticles, debouncedFilters)
    return sortArticles(filtered, debouncedFilters.sortBy)
  }, [allArticles, debouncedFilters])

  const pagination = usePagination(processedArticles, { pageSize: 20 })

  const stats = useMemo(() => {
    const published = allArticles.filter(a => a.isPublished)
    return {
      total: published.length,
      totalViews: published.reduce((sum, a) => sum + a.views, 0),
      totalHelpful: published.reduce((sum, a) => sum + a.helpfulVotes, 0),
      avgHelpful: published.length > 0
        ? Math.round(
            published.reduce((sum, a) => {
              const total = a.helpfulVotes + a.notHelpfulVotes
              return sum + (total > 0 ? (a.helpfulVotes / total) * 100 : 0)
            }, 0) / published.length
          )
        : 0,
    }
  }, [allArticles])

  const handleViewArticle = (article: Article) => {
    // Redirigir según el rol del usuario
    const role = session?.user?.role
    if (role === 'ADMIN') router.push(`/admin/knowledge/${article.id}`)
    else if (role === 'TECHNICIAN') router.push(`/technician/knowledge/${article.id}`)
    else router.push(`/knowledge/${article.id}`)
  }

  // Exportación
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'base-conocimientos',
    title: 'Base de Conocimientos',
    subtitle: `${processedArticles.length} artículos disponibles`,
    getData: () => processedArticles,
    columns: [
      { key: 'title', label: 'Título' },
      { key: 'summary', label: 'Resumen', format: v => v ?? '' },
      { key: 'category', label: 'Categoría', format: v => v?.name ?? '' },
      { key: 'family', label: 'Área', format: v => v?.name ?? '' },
      { key: 'views', label: 'Vistas' },
      { key: 'helpfulVotes', label: 'Votos útiles' },
      { key: 'helpfulPercentage', label: '% Útil', format: v => v != null ? `${v}%` : '' },
      { key: 'tags', label: 'Tags', format: v => Array.isArray(v) ? v.join(', ') : '' },
      { key: 'createdAt', label: 'Creado', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
    ],
  })

  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: processedArticles.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session) return null

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
          description={`Busca soluciones antes de crear un ticket (${processedArticles.length} artículos)`}
          data={pagination.currentItems}
          columns={createKnowledgeColumns({
            onView: handleViewArticle,
            showFamily: families.length > 1,
          })}
          loading={loading}
          pagination={paginationConfig}
          onRefresh={reload}
          externalSearch={true}
          hideInternalFilters={true}
          onRowClick={handleViewArticle}
          actions={
            <ExportButton
              onExportCSV={exportCSV}
              onExportExcel={exportExcel}
              onExportPDF={exportPDF}
              loading={exporting}
              disabled={processedArticles.length === 0}
            />
          }
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
