'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Trash2, Edit, Download } from 'lucide-react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { VisibilitySelector } from '@/components/common/visibility-selector'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { FormCategoryInlineForm } from '@/components/forms/FormCategoryInlineForm'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'

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

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administradores' },
  { value: 'TECHNICIAN', label: 'Técnicos' },
  { value: 'CLIENT', label: 'Clientes' },
]

interface FormItem {
  id: string
  title: string
  slug: string
  description?: string | null
  summary?: string | null
  version?: string | null
  categoryId?: string | null
  category?: CategoryOption | null
  familyId?: string | null
  family?: { id: string; name: string } | null
  fileUrl?: string | null
  fileSize?: number | null
  fileType?: string | null
  isActive: boolean
  isFeatured: boolean
  downloadCount: number
  createdById: string
  updatedById?: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string; email: string }
  updatedBy?: { id: string; name: string; email: string } | null
  form_roles: Array<{ id: string; role: string }>
  form_users: Array<{
    id: string
    userId: string
    user: { id: string; name: string; email: string }
  }>
  form_departments: Array<{
    id: string
    departmentId: string
    departments: { id: string; name: string }
  }>
  form_families: Array<{ id: string; familyId: string; families: { id: string; name: string } }>
  _count: { form_downloads: number }
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
  const [users, setUsers] = useState<UserOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [families, setFamilies] = useState<FamilyOption[]>([])

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingForm, setEditingForm] = useState<FormItem | null>(null)
  const [deletingForm, setDeletingForm] = useState<FormItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    summary: '',
    version: '',
    categoryId: '',
    familyId: '',
    fileUrl: '',
    fileSize: null as number | null,
    fileType: '',
    isActive: true,
    isFeatured: false,
    roles: [] as string[],
    userIds: [] as string[],
    departmentIds: [] as string[],
    familyIds: [] as string[],
  })

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    category: 'all',
  })

  const [fileFile, setFileFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'documentos',
    title: 'Documentos',
    columns: [
      { key: 'title', label: 'Título' },
      {
        key: 'category',
        label: 'Categoría',
        format: (value: any) => value?.name || 'Sin categoría',
      },
      { key: 'version', label: 'Versión', format: (value: any) => value || 'v1.0' },
      {
        key: 'isActive',
        label: 'Estado',
        format: (value: boolean) => (value ? 'Activo' : 'Inactivo'),
      },
      {
        key: 'downloads',
        label: 'Descargas',
        format: (_: any, row: FormItem) => row._count?.form_downloads || 0,
      },
      { key: 'createdBy', label: 'Creado por', format: (value: any) => value?.name || '' },
      {
        key: 'createdAt',
        label: 'Fecha',
        format: (value: string) => new Date(value).toLocaleDateString('es-EC'),
      },
    ],
    getData: () => forms,
  })

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

      if ((session.user as any).formsEnabled || (session.user as any).canManageForms) {
        setHasAccess(true)
        loadForms()
        loadUsersAndDepartments()
        loadCategories()
        return
      }

      setHasAccess(false)
      const dest = session.user.role === 'TECHNICIAN' ? '/technician' : '/client'
      router.replace(dest)
    }

    checkAccess()
  }, [session, status, router])

  const loadUsersAndDepartments = async () => {
    try {
      const [usersRes, deptsRes, familiesRes] = await Promise.all([
        fetch('/api/users?limit=500'),
        fetch('/api/departments'),
        fetch('/api/families?includeInactive=false&scope=all'),
      ])
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.users || usersData.data || [])
      }
      if (deptsRes.ok) {
        const deptsData = await deptsRes.json()
        const deptsList = deptsData.departments || deptsData.data || []
        setDepartments(deptsList)
      }
      if (familiesRes.ok) {
        const familiesData = await familiesRes.json()
        const familiesList = familiesData.data || familiesData.families || []
        const deptsRes2 = await fetch('/api/departments')
        const deptsData2 = deptsRes2.ok ? await deptsRes2.json() : { data: [] }
        const allDepts: DepartmentOption[] = deptsData2.departments || deptsData2.data || []

        const familiesWithDepts: FamilyOption[] = familiesList.map((f: any) => ({
          id: f.id,
          name: f.name,
          departments: allDepts.filter((d: any) => d.familyId === f.id),
        }))
        setFamilies(familiesWithDepts)
      }
    } catch (e) {
      console.error('Error loading users/departments/families', e)
    }
  }

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/admin/form-categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch (e) {
      console.error('Error loading categories', e)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/form-categories/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error al eliminar categoría')
      toast({
        title: 'Categoría eliminada',
        description: 'La categoría se eliminó correctamente',
      })
      loadCategories()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al eliminar categoría',
        variant: 'destructive',
      })
      throw err
    }
  }

  const loadForms = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters.category && filters.category !== 'all') params.set('categoryId', filters.category)
      if (filters.search) params.set('search', filters.search)

      const response = await fetch(`/api/admin/forms?${params.toString()}`)
      if (!response.ok) throw new Error('Error al cargar formularios')
      const data = await response.json()
      setForms(data.forms || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar formularios')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setUploadingFile(true)
      const url = editingForm ? `/api/admin/forms/${editingForm.id}` : '/api/admin/forms'
      const method = editingForm ? 'PUT' : 'POST'

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          familyId: formData.familyId || null,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Error al guardar formulario')
      }

      toast({
        title: editingForm ? 'Formulario actualizado' : 'Formulario creado',
        description: 'El formulario se guardó correctamente',
        duration: 4000,
      })

      setShowCreateDialog(false)
      setEditingForm(null)
      setFileFile(null)
      resetForm()
      loadForms()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al guardar formulario',
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setUploadingFile(false)
    }
  }

  const handleEdit = (item: FormItem) => {
    setEditingForm(item)
    setFormData({
      title: item.title,
      description: item.description || '',
      summary: item.summary || '',
      version: item.version || '',
      categoryId: item.categoryId || '',
      familyId: item.familyId || '',
      fileUrl: item.fileUrl || '',
      fileSize: item.fileSize,
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
      const response = await fetch(`/api/admin/forms/${deletingForm.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Error al eliminar formulario')

      toast({
        title: 'Formulario eliminado',
        description: 'El formulario se eliminó correctamente',
        duration: 4000,
      })

      setDeleteDialogOpen(false)
      setDeletingForm(null)
      loadForms()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al eliminar formulario',
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      summary: '',
      version: '',
      categoryId: '',
      familyId: '',
      fileUrl: '',
      fileSize: null,
      fileType: '',
      isActive: true,
      isFeatured: false,
      roles: [],
      userIds: [],
      departmentIds: [],
      familyIds: [],
    })
  }

  const columns: Column<FormItem>[] = [
    {
      key: 'title',
      label: 'Título',
      sortable: true,
      render: (item: FormItem) => (
        <div className='space-y-1'>
          <div className='font-medium'>{item.title}</div>
          {item.description && (
            <div className='text-sm text-muted-foreground'>{item.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Categoría',
      sortable: true,
      render: (item: FormItem) => (
        <Badge variant='secondary'>{item.category?.name || 'Sin categoría'}</Badge>
      ),
    },
    {
      key: 'version',
      label: 'Versión',
      sortable: true,
      render: (item: FormItem) => (
        <span className='text-sm text-muted-foreground'>{item.version || 'v1.0'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      render: (item: FormItem) => (
        <Badge variant={item.isActive ? 'default' : 'secondary'}>
          {item.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'downloads',
      label: 'Descargas',
      sortable: true,
      render: (item: FormItem) => (
        <div className='flex items-center gap-1 text-sm text-muted-foreground'>
          <Download className='h-3.5 w-3.5' />
          <span>{item._count?.form_downloads || 0}</span>
        </div>
      ),
    },
    {
      key: 'author',
      label: 'Creado por',
      sortable: true,
      render: (item: FormItem) => item.createdBy.name,
    },
    {
      key: 'date',
      label: 'Fecha',
      sortable: true,
      render: (item: FormItem) => new Date(item.createdAt).toLocaleDateString('es-EC'),
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
        ...categories.map(cat => ({ value: cat.id, label: cat.name })),
      ],
    },
  ]

  const handleTableFiltersChange = (newFilters: Record<string, string>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
    }))
  }

  if (!session || hasAccess === null) {
    return null
  }

  if (hasAccess === false) {
    return null
  }

  return (
    <ModuleLayout
      title='Gestión de Documentos'
      subtitle='Administra documentos descargables'
      loading={loading && forms.length === 0}
      headerActions={
        <Button
          size='sm'
          onClick={() => {
            resetForm()
            setEditingForm(null)
            setShowCreateDialog(true)
          }}
        >
          <Plus className='h-4 w-4 mr-2' />
          Nuevo documento
        </Button>
      }
    >
      <div className='space-y-4'>
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
          onFiltersChange={handleTableFiltersChange}
          rowActions={(item: FormItem) => {
            const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
            const isOwner = item.createdBy.id === session?.user?.id
            const canModify = isSuperAdmin || isOwner

            return (
              <div className='flex gap-2'>
                {canModify && (
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
                )}
                {canModify && (
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
                )}
                {!canModify && (
                  <span className='text-xs text-muted-foreground px-2'>Solo lectura</span>
                )}
              </div>
            )
          }}
          emptyState={{
            icon: <FileText className='h-10 w-10 text-muted-foreground mx-auto mb-3' />,
            title: 'No hay formularios',
            description: 'No se encontraron formularios en el sistema',
            action: (
              <Button
                size='sm'
                onClick={() => {
                  resetForm()
                  setShowCreateDialog(true)
                }}
              >
                <Plus className='h-4 w-4 mr-2' />
                Crear primer formulario
              </Button>
            ),
          }}
        />
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className='sm:max-w-3xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingForm ? 'Editar documento' : 'Nuevo documento'}</DialogTitle>
            <DialogDescription>
              Complete la información para {editingForm ? 'actualizar' : 'crear'} el documento
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2 col-span-2'>
                <Label>Título</Label>
                <Input
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className='space-y-2 col-span-2'>
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className='space-y-2'>
                <Label>Resumen (opcional)</Label>
                <Input
                  value={formData.summary}
                  onChange={e => setFormData({ ...formData, summary: e.target.value })}
                />
              </div>
              <div className='space-y-2'>
                <Label>Versión (opcional)</Label>
                <Input
                  value={formData.version}
                  onChange={e => setFormData({ ...formData, version: e.target.value })}
                  placeholder='v1.0'
                />
              </div>
              <div className='space-y-2'>
                <Label>Categoría</Label>
                <InlineCreateSelect
                  options={categories}
                  value={formData.categoryId}
                  onChange={v => {
                    setFormData({ ...formData, categoryId: v })
                  }}
                  placeholder='Seleccionar categoría'
                  createLabel='Crear categoría'
                  createTitle='Crear categoría'
                  editTitle='Editar categoría'
                  allowClear
                  createForm={FormCategoryInlineForm}
                  onDelete={handleDeleteCategory}
                  deleteConfirmMessage='¿Eliminar esta categoría? Los documentos asociados se quedarán sin categoría.'
                />
              </div>
              <div className='space-y-2'>
                <Label>Área (opcional)</Label>
                <Select
                  value={formData.familyId}
                  onValueChange={v => setFormData({ ...formData, familyId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Todas las áreas' />
                  </SelectTrigger>
                  <SelectContent>
                    {families.map(fam => (
                      <SelectItem key={fam.id} value={fam.id}>
                        {fam.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2 col-span-2'>
                <Label>Archivo (opcional)</Label>
                <div className='space-y-2'>
                  <Input
                    type='file'
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setFileFile(file)
                        setFormData({
                          ...formData,
                          fileUrl: '',
                          fileSize: file.size,
                          fileType: file.type,
                        })
                      }
                    }}
                  />
                  {fileFile && (
                    <p className='text-xs text-muted-foreground'>
                      📎 {fileFile.name} ({(fileFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                  {!fileFile && (
                    <Input
                      value={formData.fileUrl}
                      onChange={e => setFormData({ ...formData, fileUrl: e.target.value })}
                      placeholder='O pega una URL del archivo...'
                    />
                  )}
                </div>
              </div>
            </div>
            <div className='space-y-4 pt-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={v => setFormData({ ...formData, isActive: v })}
                  />
                  <Label>Activo</Label>
                </div>
                <div className='flex items-center gap-2'>
                  <Switch
                    checked={formData.isFeatured}
                    onCheckedChange={v => setFormData({ ...formData, isFeatured: v })}
                  />
                  <Label>Destacado</Label>
                </div>
              </div>

              <Separator />

              <VisibilitySelector
                families={families}
                users={users}
                selectedRoles={formData.roles}
                selectedFamilyIds={formData.familyIds}
                selectedDepartmentIds={formData.departmentIds}
                selectedUserIds={formData.userIds}
                onRolesChange={roles => setFormData(prev => ({ ...prev, roles }))}
                onFamilyIdsChange={familyIds => setFormData(prev => ({ ...prev, familyIds }))}
                onDepartmentIdsChange={departmentIds =>
                  setFormData(prev => ({ ...prev, departmentIds }))
                }
                onUserIdsChange={userIds => setFormData(prev => ({ ...prev, userIds }))}
              />
            </div>
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
              <Button type='submit' disabled={uploadingFile}>
                {uploadingFile ? 'Guardando...' : editingForm ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className='sm:max-w-[425px]' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>¿Eliminar formulario?</DialogTitle>
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
    </ModuleLayout>
  )
}
