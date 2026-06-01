'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Trash2, Edit, Download, Star } from 'lucide-react'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable, Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { VisibilitySelector } from '@/components/common/visibility-selector'
import { MediaUrlInput } from '@/components/common/media-url-input'
import { FileDropZone } from '@/components/common/file-drop-zone'
import type { PendingFile } from '@/components/common/file-drop-zone'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { FormCategoryInlineForm } from '@/components/forms/FormCategoryInlineForm'
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

const EMPTY_FORM = {
  title: '',
  description: '',
  summary: '',
  version: '',
  categoryId: '',
  fileUrl: '',
  fileSize: null as number | null,
  fileType: '',
  isActive: true,
  isFeatured: false,
  roles: [] as string[],
  userIds: [] as string[],
  departmentIds: [] as string[],
  familyIds: [] as string[],
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
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [filters, setFilters] = useState({ search: '', status: 'all', category: 'all' })
  const [fileFile, setFileFile] = useState<File | null>(null)
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
        fetch('/api/users?limit=500'),
        fetch('/api/departments'),
        fetch('/api/families?includeInactive=false&scope=all'),
      ])
      if (usersRes.ok) setUsers((await usersRes.json()).users || [])
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
            departments: allDepts.filter((d: any) => d.familyId === f.id),
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
      setFileFile(null)
      setPendingFiles([])
      setFormData({ ...EMPTY_FORM })
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
    setFileFile(null)
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
            setFormData({ ...EMPTY_FORM })
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
                setFormData({ ...EMPTY_FORM })
                setShowCreateDialog(true)
              }}
            >
              <Plus className='h-4 w-4 mr-2' />
              Crear primer documento
            </Button>
          ),
        }}
      />

      {/* ── Dialog crear / editar ─────────────────────────────────────────── */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={open => {
          setShowCreateDialog(open)
          if (!open) {
            setEditingForm(null)
            setFileFile(null)
            setPendingFiles([])
          }
        }}
      >
        <DialogContent className='sm:max-w-3xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingForm ? 'Editar documento' : 'Nuevo documento'}</DialogTitle>
            <DialogDescription>
              Complete la información para {editingForm ? 'actualizar' : 'crear'} el documento
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              {/* Título */}
              <div className='space-y-2 col-span-2'>
                <Label>
                  Título <span className='text-destructive'>*</span>
                </Label>
                <Input
                  required
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              {/* Descripción */}
              <div className='space-y-2 col-span-2'>
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                />
              </div>
              {/* Resumen */}
              <div className='space-y-2'>
                <Label>Resumen (opcional)</Label>
                <Input
                  value={formData.summary}
                  onChange={e => setFormData(p => ({ ...p, summary: e.target.value }))}
                />
              </div>
              {/* Versión */}
              <div className='space-y-2'>
                <Label>Versión (opcional)</Label>
                <Input
                  value={formData.version}
                  onChange={e => setFormData(p => ({ ...p, version: e.target.value }))}
                  placeholder='v1.0'
                />
              </div>
              {/* Categoría */}
              <div className='space-y-2 col-span-2'>
                <Label>
                  Categoría <span className='text-destructive'>*</span>
                </Label>{' '}
                <InlineCreateSelect
                  options={categories.map(c => ({
                    id: c.id,
                    name: c.name,
                    description: c.description ?? undefined,
                  }))}
                  value={formData.categoryId}
                  onChange={v => setFormData(p => ({ ...p, categoryId: v }))}
                  placeholder='Seleccionar categoría'
                  createLabel='Crear categoría'
                  createTitle='Crear categoría'
                  editTitle='Editar categoría'
                  allowClear
                  createForm={FormCategoryInlineForm}
                  onDelete={handleDeleteCategory}
                  deleteConfirmMessage='¿Eliminar esta categoría? Los documentos asociados quedarán sin categoría.'
                  onAfterSave={() => loadCategories()}
                />
              </div>
              {/* Archivo */}
              <div className='space-y-2 col-span-2'>
                <Label>Archivo</Label>
                <div className='space-y-3'>
                  {/* Archivo ya guardado (al editar) — se muestra mientras no haya pendientes */}
                  {editingForm?.fileUrl && pendingFiles.length === 0 && (
                    <div className='flex items-center gap-3 p-3 rounded-lg border bg-muted/30'>
                      <span className='text-xl'>
                        {editingForm.fileType?.includes('pdf')
                          ? '📕'
                          : editingForm.fileType?.includes('word')
                            ? '📘'
                            : editingForm.fileType?.includes('excel')
                              ? '📗'
                              : editingForm.fileType?.includes('image')
                                ? '🖼️'
                                : '📄'}
                      </span>
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm font-medium truncate'>
                          {editingForm.fileType || 'Archivo adjunto'}
                        </p>
                        {editingForm.fileSize && (
                          <p className='text-xs text-muted-foreground'>
                            {editingForm.fileSize < 1024 * 1024
                              ? `${(editingForm.fileSize / 1024).toFixed(1)} KB`
                              : `${(editingForm.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                          </p>
                        )}
                      </div>
                      <div className='flex gap-2 flex-shrink-0'>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => window.open(editingForm.fileUrl!, '_blank')}
                        >
                          Ver
                        </Button>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='text-destructive hover:text-destructive'
                          onClick={() =>
                            setFormData(p => ({ ...p, fileUrl: '', fileSize: null, fileType: '' }))
                          }
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Zona drag & drop para nuevo archivo */}
                  <FileDropZone
                    pendingFiles={pendingFiles}
                    onPendingFilesChange={files => {
                      setPendingFiles(files)
                      // Sincronizar metadatos del primer archivo con formData
                      if (files.length > 0) {
                        const f = files[0].file
                        setFormData(p => ({
                          ...p,
                          fileUrl: '',
                          fileSize: f.size,
                          fileType: f.type,
                        }))
                      } else {
                        setFormData(p => ({
                          ...p,
                          fileUrl: editingForm?.fileUrl || '',
                          fileSize: editingForm?.fileSize ?? null,
                          fileType: editingForm?.fileType || '',
                        }))
                      }
                    }}
                    maxFiles={1}
                    acceptLabel='PDF, Word, Excel, imágenes'
                    accept='.pdf,.doc,.docx,.xls,.xlsx,image/*'
                    allowedTypes={[
                      'application/pdf',
                      'application/msword',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'application/vnd.ms-excel',
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                      'image/jpeg',
                      'image/jpg',
                      'image/png',
                      'image/gif',
                      'image/webp',
                    ]}
                  />

                  {/* URL externa — solo si no hay archivo pendiente ni adjunto actual */}
                  {pendingFiles.length === 0 && !editingForm?.fileUrl && (
                    <MediaUrlInput
                      label=''
                      value={formData.fileUrl}
                      onChange={v => setFormData(p => ({ ...p, fileUrl: v }))}
                      placeholder='O pega una URL externa (Google Drive, OneDrive, Dropbox, PDF...)'
                      optional={false}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Switches */}
            <div className='flex items-center gap-6 pt-2'>
              <div className='flex items-center gap-2'>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={v => setFormData(p => ({ ...p, isActive: v }))}
                />
                <Label>Activo</Label>
              </div>
              <div className='flex items-center gap-2'>
                <Switch
                  checked={formData.isFeatured}
                  onCheckedChange={v => setFormData(p => ({ ...p, isFeatured: v }))}
                />
                <Label>Destacado</Label>
              </div>
            </div>

            <Separator />

            {/* Visibilidad */}
            <VisibilitySelector
              families={families}
              users={users}
              selectedRoles={formData.roles}
              selectedFamilyIds={formData.familyIds}
              selectedDepartmentIds={formData.departmentIds}
              selectedUserIds={formData.userIds}
              onRolesChange={roles => setFormData(p => ({ ...p, roles }))}
              onFamilyIdsChange={familyIds => setFormData(p => ({ ...p, familyIds }))}
              onDepartmentIdsChange={departmentIds => setFormData(p => ({ ...p, departmentIds }))}
              onUserIdsChange={userIds => setFormData(p => ({ ...p, userIds }))}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setShowCreateDialog(false)
                  setEditingForm(null)
                }}
              >
                Cancelar
              </Button>
              <Button type='submit' disabled={saving}>
                {saving ? 'Guardando...' : editingForm ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
