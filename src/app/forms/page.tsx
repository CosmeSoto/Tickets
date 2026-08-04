'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FileText, Download, Star, Plus, Edit, Trash2 } from 'lucide-react'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable, Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import { FormCard } from '@/components/forms/FormCard'
import { FormDetail } from '@/components/forms/FormDetail'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { DocumentFormDialog, EMPTY_DOCUMENT_FORM } from '@/components/forms/DocumentFormDialog'
import type { DocumentFormData } from '@/components/forms/DocumentFormDialog'
import type { PendingFile } from '@/components/common/file-drop-zone'
import type { FormFeedItem, FormItem } from '@/components/forms/types'

interface CategoryOption {
  id: string
  name: string
  description?: string | null
}

interface UserOption {
  id: string
  name: string
  email: string
}
interface DepartmentOption {
  id: string
  name: string
  familyId?: string | null
}
interface FamilyOption {
  id: string
  name: string
  departments: DepartmentOption[]
}

export default function PublicFormsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const accessChecked = useRef(false)

  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [forms, setForms] = useState<FormFeedItem[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards')
  const [selectedForm, setSelectedForm] = useState<FormFeedItem | null>(null)
  const [filters, setFilters] = useState({ search: '', category: 'all' })

  // Gestión (solo si canManage)
  const [users, setUsers] = useState<UserOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [families, setFamilies] = useState<FamilyOption[]>([])
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['ADMIN', 'TECHNICIAN', 'CLIENT'])
  const [requireFamilyRestriction, setRequireFamilyRestriction] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingForm, setEditingForm] = useState<FormItem | null>(null)
  const [deletingForm, setDeletingForm] = useState<FormFeedItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<DocumentFormData>({ ...EMPTY_DOCUMENT_FORM })
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])

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
      setCanManage(true)
      loadForms()
      loadCategories()
      loadUsersAndDepartments()
      return
    }

    const checkAccess = async () => {
      try {
        const res = await fetch(`/api/users/${session.user.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.user?.formsEnabled || data.user?.canManageForms) {
            // Ver: formsEnabled. Crear: canManageForms (+ módulo activo).
            const manage = !!(data.user?.canManageForms && data.user?.formsEnabled)
            setHasAccess(true)
            setCanManage(manage)
            loadForms()
            loadCategories()
            if (manage) loadUsersAndDepartments()
            return
          }
        }
      } catch {}
      try {
        const res = await fetch(`/api/user/modules?_t=${Date.now()}`)
        if (res.ok) {
          const modules = await res.json()
          if (modules.forms || modules.canManageForms) {
            const manage = !!(modules.canManageForms && modules.forms)
            setHasAccess(true)
            setCanManage(manage)
            loadForms()
            loadCategories()
            if (manage) loadUsersAndDepartments()
            return
          }
        }
      } catch {}
      if ((session.user as any).formsEnabled) {
        const manage = !!(session.user as any).canManageForms
        setHasAccess(true)
        setCanManage(manage)
        loadForms()
        loadCategories()
        if (manage) loadUsersAndDepartments()
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

  const loadUsersAndDepartments = async () => {
    try {
      const visRes = await fetch('/api/content/visibility-options')
      if (visRes.ok) {
        const vis = await visRes.json()
        setUsers(vis.users || [])
        setFamilies(
          (vis.families || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            departments: f.departments || [],
          }))
        )
        setDepartments(
          (vis.families || []).flatMap((f: any) =>
            (f.departments || []).map((d: any) => ({ ...d, familyId: f.id }))
          )
        )
        if (vis.scope?.allowedRoles) setAllowedRoles(vis.scope.allowedRoles)
        setRequireFamilyRestriction(!!vis.scope?.requireFamilyRestriction)
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

  // ── CRUD (solo canManage) ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.categoryId) {
      toast({
        title: 'Categoría requerida',
        description: 'Selecciona o crea una categoría',
        variant: 'destructive',
      })
      return
    }
    try {
      setSaving(true)
      const url = editingForm ? `/api/admin/forms/${editingForm.id}` : '/api/admin/forms'
      let fileType = formData.fileType
      if (formData.fileUrl && pendingFiles.length === 0 && !fileType) {
        const ext = formData.fileUrl.split('?')[0].split('.').pop()?.toLowerCase()
        const extMap: Record<string, string> = {
          pdf: 'application/pdf',
          doc: 'application/msword',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          xls: 'application/vnd.ms-excel',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
        }
        fileType = ext ? extMap[ext] || '' : ''
      }
      const res = await fetch(url, {
        method: editingForm ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, fileType, familyId: null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al guardar')
      }
      const result = await res.json()
      const savedId = result.form?.id
      if (pendingFiles.length > 0 && savedId) {
        await Promise.allSettled(
          pendingFiles.map(pf => {
            const fd = new FormData()
            fd.append('file', pf.file)
            return fetch(`/api/admin/forms/${savedId}/attachments`, { method: 'POST', body: fd })
          })
        )
      }
      toast({ title: editingForm ? 'Documento actualizado' : 'Documento creado' })
      setShowCreateDialog(false)
      setEditingForm(null)
      setPendingFiles([])
      setFormData({ ...EMPTY_DOCUMENT_FORM })
      loadForms()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al guardar',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (item: FormFeedItem) => {
    try {
      // Obtener datos completos del documento (con relaciones de visibilidad)
      const res = await fetch(`/api/admin/forms/${item.id}`)
      const fi: FormItem = res.ok ? (await res.json()).form || (item as any) : (item as any)
      setEditingForm(fi)
      setPendingFiles([])
      setFormData({
        title: fi.title,
        description: fi.description || '',
        summary: fi.summary || '',
        version: fi.version || '',
        categoryId: fi.categoryId || '',
        fileUrl: fi.fileUrl || '',
        fileSize: fi.fileSize ?? null,
        fileType: fi.fileType || '',
        isActive: fi.isActive,
        isFeatured: fi.isFeatured,
        roles: fi.form_roles?.map((r: any) => r.role) || [],
        userIds: fi.form_users?.map((u: any) => u.userId) || [],
        departmentIds: fi.form_departments?.map((d: any) => d.departmentId) || [],
        familyIds: fi.form_families?.map((f: any) => f.familyId) || [],
      })
      setShowCreateDialog(true)
    } catch {
      toast({ title: 'Error al cargar documento', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deletingForm) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/forms/${deletingForm.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      toast({ title: 'Documento eliminado' })
      setDeleteDialogOpen(false)
      setDeletingForm(null)
      loadForms()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al eliminar',
        variant: 'destructive',
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    const res = await fetch(`/api/admin/form-categories/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Error al eliminar categoría')
    }
    toast({ title: 'Categoría eliminada' })
    loadCategories()
  }

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
      subtitle={
        canManage
          ? 'Gestiona los documentos de tus familias'
          : 'Accede a los documentos disponibles para ti'
      }
      loading={loading && forms.length === 0}
      headerActions={
        canManage ? (
          <Button
            size='sm'
            onClick={() => {
              setFormData({ ...EMPTY_DOCUMENT_FORM })
              setEditingForm(null)
              setShowCreateDialog(true)
            }}
          >
            <Plus className='h-4 w-4 mr-2' />
            Nuevo documento
          </Button>
        ) : undefined
      }
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
        rowActions={
          canManage
            ? item => (
                <div className='flex gap-1'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={e => {
                      e.stopPropagation()
                      handleEdit(item)
                    }}
                  >
                    <Edit className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={e => {
                      e.stopPropagation()
                      setDeletingForm(item)
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className='h-4 w-4 text-destructive' />
                  </Button>
                </div>
              )
            : undefined
        }
        cardRenderer={item => <FormCard form={item} onClick={() => setSelectedForm(item)} />}
        emptyState={{
          icon: <FileText className='h-10 w-10 text-muted-foreground mx-auto mb-3' />,
          title: 'No hay documentos disponibles',
          description: 'No se encontraron documentos para tu perfil en este momento',
          action: canManage ? (
            <Button
              size='sm'
              onClick={() => {
                setFormData({ ...EMPTY_DOCUMENT_FORM })
                setShowCreateDialog(true)
              }}
            >
              <Plus className='h-4 w-4 mr-2' />
              Crear primer documento
            </Button>
          ) : undefined,
        }}
      />

      {selectedForm && (
        <FormDetail
          form={selectedForm}
          isOpen={!!selectedForm}
          onClose={() => setSelectedForm(null)}
          mode={canManage ? 'manage' : 'view'}
          onEdit={canManage ? handleEdit : undefined}
          onDelete={
            canManage
              ? item => {
                  setDeletingForm(item)
                  setDeleteDialogOpen(true)
                }
              : undefined
          }
          onDownloaded={loadForms}
        />
      )}

      {/* ── Dialog crear / editar — componente unificado DocumentFormDialog ── */}
      {canManage && (
        <DocumentFormDialog
          open={showCreateDialog}
          onOpenChange={open => {
            setShowCreateDialog(open)
            if (!open) {
              setEditingForm(null)
              setPendingFiles([])
              setFormData({ ...EMPTY_DOCUMENT_FORM })
            }
          }}
          formData={formData}
          setFormData={setFormData}
          pendingFiles={pendingFiles}
          setPendingFiles={setPendingFiles}
          editingForm={editingForm}
          categories={categories}
          users={users}
          families={families}
          saving={saving}
          onSubmit={handleSubmit}
          onDeleteCategory={handleDeleteCategory}
          onLoadCategories={loadCategories}
          collapseAdvanced
          usersHint='Usuarios de tu alcance (áreas asignadas)'
          allowedRoles={allowedRoles}
          requireFamilyRestriction={requireFamilyRestriction}
        />
      )}

      {/* ── Dialog eliminar ───────────────────────────────────────────────── */}
      {canManage && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Eliminar documento</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar <strong>{deletingForm?.title}</strong>? Esta
                acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant='destructive' onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ModuleLayout>
  )
}
