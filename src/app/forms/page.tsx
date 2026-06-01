'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FileText, Download, Star } from 'lucide-react'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable, Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import { FormCard } from '@/components/forms/FormCard'
import { FormDetail } from '@/components/forms/FormDetail'
import type { FormFeedItem } from '@/components/forms/types'

interface CategoryOption {
  id: string
  name: string
}

export default function PublicFormsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const accessChecked = useRef(false)

  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [forms, setForms] = useState<FormFeedItem[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards')
  const [selectedForm, setSelectedForm] = useState<FormFeedItem | null>(null)

  const [filters, setFilters] = useState({ search: '', category: 'all' })

  // ── Exportación ────────────────────────────────────────────────────────────
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'documentos',
    title: 'Documentos',
    columns: [
      { key: 'title', label: 'Título' },
      { key: 'category', label: 'Categoría', format: (v: any) => v?.name || 'Sin categoría' },
      { key: 'version', label: 'Versión', format: (v: any) => (v ? `v${v}` : '—') },
      { key: 'createdBy', label: 'Autor', format: (v: any) => v?.name || '' },
      {
        key: 'createdAt',
        label: 'Fecha',
        format: (v: string) => new Date(v).toLocaleDateString('es-EC'),
      },
      {
        key: '_count',
        label: 'Descargas',
        format: (v: any) => String(v?.form_downloads ?? 0),
      },
    ],
    getData: () => forms,
  })

  // ── Acceso ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return
    if (accessChecked.current) return
    if (!session) {
      router.push('/login')
      return
    }

    accessChecked.current = true

    if (session.user.role === 'ADMIN' || (session.user as any).isSuperAdmin) {
      setHasAccess(true)
      loadForms()
      loadCategories()
      return
    }

    const checkAccess = async () => {
      try {
        const res = await fetch(`/api/users/${session.user.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.user?.formsEnabled) {
            setHasAccess(true)
            loadForms()
            loadCategories()
            return
          }
        }
      } catch {}
      try {
        const res = await fetch(`/api/user/modules?_t=${Date.now()}`)
        if (res.ok) {
          const modules = await res.json()
          if (modules.forms) {
            setHasAccess(true)
            loadForms()
            loadCategories()
            return
          }
        }
      } catch {}
      if ((session.user as any).formsEnabled) {
        setHasAccess(true)
        loadForms()
        loadCategories()
        return
      }
      setHasAccess(false)
      router.replace(session.user.role === 'TECHNICIAN' ? '/technician' : '/client')
    }
    checkAccess()
  }, [session, status, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/admin/form-categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch {}
  }

  const loadForms = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.category && filters.category !== 'all') params.set('categoryId', filters.category)
      if (filters.search) params.set('search', filters.search)
      const res = await fetch(`/api/forms?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setForms(data.forms || [])
    } catch {
      setForms([])
    } finally {
      setLoading(false)
    }
  }

  // Recargar cuando cambian los filtros
  useEffect(() => {
    if (hasAccess) loadForms()
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Columnas de tabla ──────────────────────────────────────────────────────
  const columns: Column<FormFeedItem>[] = [
    {
      key: 'title',
      label: 'Documento',
      sortable: true,
      render: item => (
        <div className='flex items-center gap-3 min-w-0'>
          <span className='text-xl flex-shrink-0'>
            {item.fileType?.includes('pdf')
              ? '📕'
              : item.fileType?.includes('word')
                ? '📘'
                : item.fileType?.includes('excel')
                  ? '📗'
                  : item.fileType?.includes('image')
                    ? '🖼️'
                    : '📄'}
          </span>
          <div className='min-w-0'>
            <div className='font-medium flex items-center gap-1.5'>
              {item.title}
              {item.isFeatured && <Star className='h-3.5 w-3.5 text-primary flex-shrink-0' />}
            </div>
            {item.description && (
              <div className='text-xs text-muted-foreground line-clamp-1'>{item.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Categoría',
      sortable: true,
      render: item =>
        item.category ? (
          <Badge variant='secondary'>{item.category.name}</Badge>
        ) : (
          <span className='text-muted-foreground text-xs'>—</span>
        ),
    },
    {
      key: 'version',
      label: 'Versión',
      sortable: true,
      render: item =>
        item.version ? (
          <span className='text-sm text-muted-foreground'>v{item.version}</span>
        ) : (
          <span className='text-muted-foreground text-xs'>—</span>
        ),
    },
    {
      key: 'createdBy',
      label: 'Autor',
      sortable: true,
      render: item => <span className='text-sm'>{item.createdBy.name}</span>,
    },
    {
      key: 'createdAt',
      label: 'Fecha',
      sortable: true,
      render: item => (
        <span className='text-sm text-muted-foreground'>
          {new Date(item.createdAt).toLocaleDateString('es-EC')}
        </span>
      ),
    },
    {
      key: '_count',
      label: 'Descargas',
      sortable: true,
      render: item => (
        <span className='flex items-center gap-1 text-sm text-muted-foreground'>
          <Download className='h-3.5 w-3.5' />
          {item._count.form_downloads}
        </span>
      ),
    },
  ]

  const tableFilters = [
    {
      key: 'category',
      label: 'Categoría',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todas' },
        ...categories.map(c => ({ value: c.id, label: c.name })),
      ],
    },
  ]

  if (!session || hasAccess === null) return null
  if (hasAccess === false) return null

  return (
    <ModuleLayout
      title='Documentos'
      subtitle='Accede a los documentos disponibles para ti'
      loading={loading && forms.length === 0}
    >
      <DataTable
        title={`${forms.length} documento${forms.length !== 1 ? 's' : ''}`}
        description='Documentos disponibles según tu perfil'
        data={forms}
        columns={columns}
        loading={loading}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={loadForms}
        onExport={
          <ExportButton
            onExportCSV={exportCSV}
            onExportExcel={exportExcel}
            onExportPDF={exportPDF}
            loading={exporting}
          />
        }
        filters={tableFilters}
        onFiltersChange={f => setFilters(prev => ({ ...prev, ...f }))}
        onRowClick={item => setSelectedForm(item)}
        cardRenderer={item => <FormCard form={item} onClick={() => setSelectedForm(item)} />}
        emptyState={{
          icon: <FileText className='h-10 w-10 text-muted-foreground mx-auto mb-3' />,
          title: 'No hay documentos disponibles',
          description: 'No se encontraron documentos para tu perfil en este momento',
        }}
      />

      {selectedForm && (
        <FormDetail
          form={selectedForm}
          isOpen={!!selectedForm}
          onClose={() => setSelectedForm(null)}
          mode='view'
          onDownloaded={loadForms}
        />
      )}
    </ModuleLayout>
  )
}
