'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Trash2, Edit, Download, Star } from 'lucide-react'
import { DocumentFormDialog, EMPTY_DOCUMENT_FORM } from '@/components/forms/DocumentFormDialog'
import type { DocumentFormData } from '@/components/forms/DocumentFormDialog'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable, Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import type { PendingFile } from '@/components/common/file-drop-zone'
import { FormDetail } from '@/components/forms/FormDetail'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import type { FormItem } from '@/components/forms/types'

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
interface CategoryOption {
  id: string
  name: string
  description?: string | null
}

export default function AdminFormsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const accessChecked = useRef(false)

  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [forms, setForms] = useState<FormItem[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [selectedForm, setSelectedForm] = useState<FormItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [users, setUsers] = useState<UserOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [families, setFamilies] = useState<FamilyOption[]>([])

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingForm, setEditingForm] = useState<FormItem | null>(null)
  const [deletingForm, setDeletingForm] = useState<FormItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<DocumentFormData>({ ...EMPTY_DOCUMENT_FORM })
  const [filters, setFilters] = useState({ search: '', status: 'all', category: 'all' })
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])

  // ── Exportación ────────────────────────────────────────────────────────────
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'documentos-admin',
    title: 'Gestión de Documentos',
    columns: [
      { key: 'title', label: 'Título' },
      { key: 'category', label: 'Categoría', format: (v: any) => v?.name || 'Sin categoría' },
      { key: 'version', label: 'Versión', format: (v: any) => (v ? `v${v}` : '—') },
      { key: 'isActive', label: 'Estado', format: (v: boolean) => (v ? 'Activo' : 'Inactivo') },
      { key: 'isFeatured', label: 'Destacado', format: (v: boolean) => (v ? 'Sí' : 'No') },
      { key: '_count', label: 'Descargas', format: (v: any) => String(v?.form_downloads ?? 0) },
      { key: 'createdBy', label: 'Creado por', format: (v: any) => v?.name || '' },
      {
        key: 'createdAt',
        label: 'Fecha',
        format: (v: string) => new Date(v).toLocaleDateString('es-EC'),
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
      loadUsersAndDepartments()
      loadCategories()
      return
    }

    const checkAccess = async () => {
      try {
        const res = await fetch(`/api/users/${session.user.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.user?.formsEnabled || data.user?.canManageForms) {
            setHasAccess(true)
            loadForms()
            loadUsersAndDepartments()
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
            loadUsersAndDepartments()
            loadCategories()
            return
          }
        }
      } catch {}
      setHasAccess(false)
      router.replace(session.user.role === 'TECHNICIAN' ? '/technician' : '/client')
    }
    checkAccess()
  }, [session, status, router]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carga de datos ─────────────────────────────────────────────────────────
  const loadUsersAndDepartments = async () => {
    try {
      const [usersRes, deptsRes, familiesRes] = await Promise.all([
        // Solo usuarios con el módulo de documentos activo (formsEnabled=true) o admins.
        fetch('/api/users?limit=500&isActive=true&formsEnabled=true'),
        fetch('/api/departments'),
        fetch('/api/families?includeInactive=false&scope=all'),
      ])
      if (usersRes.ok) setUsers((await usersRes.json()).data || [])
      if (deptsRes.ok) {
        const d = await deptsRes.json()
        setDepartments(d.departments || d.data || [])
      }
      if (familiesRes.ok) {
        const fd = await familiesRes.json()
        const fList = fd.data || fd.families || []
        const d2Res = await fetch('/api/departments')
        const allDepts: DepartmentOption[] = d2Res.ok ? (await d2Res.json()).departments || [] : []
        setFamilies(
          fList.map((f: any) => ({
            id: f.id,
            name: f.name,
            departments: allDepts.filter((d: any) => d.familyId === f.id || d.family?.id === f.id),
          }))
        )
      }
    } catch {}
  }

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/admin/form-categories')
      if (res.ok) setCategories((await res.json()).categories || [])
    } catch {}
  }

  const loadForms = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.status !== 'all') params.set('status', filters.status)
      if (filters.category !== 'all') params.set('categoryId', filters.category)
      if (filters.search) params.set('search', filters.search)
      const res = await fetch(`/api/admin/forms?${params.toString()}`)
      if (!res.ok) throw new Error('Error al cargar documentos')
      setForms((await res.json()).forms || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasAccess) loadForms()
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── CRUD ───────────────────────────────────────────────────────────────────
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

      // Si hay URL externa escrita manualmente, detectar tipo por extensión
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
          gif: 'image/gif',
          webp: 'image/webp',
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

      // Subir archivos pendientes (FileDropZone) si los hay
      if (pendingFiles.length > 0 && savedId) {
        const uploadResults = await Promise.allSettled(
          pendingFiles.map(pf => {
            const uploadData = new FormData()
            uploadData.append('file', pf.file)
            return fetch(`/api/admin/forms/${savedId}/attachments`, {
              method: 'POST',
              body: uploadData,
            })
          })
        )
        const failed = uploadResults.filter(r => r.status === 'rejected').length
        if (failed > 0) {
          toast({
            title: 'Documento guardado, pero algunos archivos fallaron',
            description: `${pendingFiles.length - failed} subidos, ${failed} fallaron`,
            variant: 'destructive',
            duration: 6000,
          })
        }
      }

      toast({ title: editingForm ? 'Documento actualizado' : 'Documento creado', duration: 4000 })
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

  const handleEdit = (item: FormItem) => {
    setEditingForm(item)
    setPendingFiles([])
    setFormData({
      title: item.title,
      description: item.description || '',
      summary: item.summary || '',
      version: item.version || '',
      categoryId: item.categoryId || '',
      fileUrl: item.fileUrl || '',
      fileSize: item.fileSize ?? null,
      fileType: item.fileType || '',
      isActive: item.isActive,
      isFeatured: item.isFeatured,
      roles: item.form_roles.map(r => r.role),
      userIds: item.form_users.map(u => u.userId),
      departmentIds: item.form_departments.map(d => d.departmentId),
      familyIds: item.form_families.map(f => f.familyId),
    })
    setShowCreateDialog(true)
  }

  const handleDelete = async () => {
    if (!deletingForm) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/forms/${deletingForm.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      toast({ title: 'Documento eliminado', duration: 4000 })
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

  // ── Columnas ───────────────────────────────────────────────────────────────
  const columns: Column<FormItem>[] = [
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
          <span className='text-muted-foreground text-xs'>Sin categoría</span>
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
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      render: item => (
        <Badge variant={item.isActive ? 'default' : 'secondary'}>
          {item.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: '_count',
      label: 'Descargas',
      sortable: true,
      render: item => (
        <span className='flex items-center gap-1 text-sm text-muted-foreground'>
          <Download className='h-3.5 w-3.5' />
          {item._count?.form_downloads ?? 0}
        </span>
      ),
    },
    {
      key: 'createdBy',
      label: 'Creado por',
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
  ]

  const tableFilters = [
    {
      key: 'status',
      label: 'Estado',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'active', label: 'Activos' },
        { value: 'inactive', label: 'Inactivos' },
      ],
    },
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ModuleLayout
      title='Gestión de Documentos'
      subtitle='Administra documentos descargables'
      loading={loading && forms.length === 0}
      headerActions={
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
      }
    >
      <DataTable
        title={`${forms.length} documento${forms.length !== 1 ? 's' : ''}`}
        description='Todos los documentos del sistema'
        data={forms}
        columns={columns}
        loading={loading}
        error={error}
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
        onRowClick={item => {
          setSelectedForm(item)
          setDetailOpen(true)
        }}
        rowActions={item => {
          const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
          const isOwner = item.createdBy.id === session?.user?.id
          const canModify = isSuperAdmin || isOwner
          if (!canModify)
            return <span className='text-xs text-muted-foreground px-2'>Solo lectura</span>
          return (
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
        }}
        emptyState={{
          icon: <FileText className='h-10 w-10 text-muted-foreground mx-auto mb-3' />,
          title: 'No hay documentos',
          description: 'No se encontraron documentos en el sistema',
          action: (
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
          ),
        }}
      />

      {/* ── Dialog crear / editar — componente unificado DocumentFormDialog ── */}
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
      />

      {/* ── Dialog eliminar ───────────────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className='sm:max-w-[425px]' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>¿Eliminar documento?</DialogTitle>
            <DialogDescription>
              {deletingForm && (
                <>
                  Estás a punto de eliminar:{' '}
                  <span className='font-semibold'>{deletingForm.title}</span>
                  <br />
                  <br />
                  Esta acción no se puede deshacer.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type='button'
              variant='destructive'
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog detalle (onRowClick) ───────────────────────────────────── */}
      {selectedForm && (
        <FormDetail
          form={selectedForm as any}
          isOpen={detailOpen}
          onClose={() => {
            setDetailOpen(false)
            setSelectedForm(null)
          }}
          mode='manage'
          onEdit={item => {
            setDetailOpen(false)
            setSelectedForm(null)
            handleEdit(item as unknown as FormItem)
          }}
          onDelete={item => {
            setDetailOpen(false)
            setSelectedForm(null)
            setDeletingForm(item as unknown as FormItem)
            setDeleteDialogOpen(true)
          }}
          onDownloaded={loadForms}
        />
      )}
    </ModuleLayout>
  )
}
