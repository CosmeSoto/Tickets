'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Newspaper, Trash2, Edit, Eye, CheckCircle2, XCircle } from 'lucide-react'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable, Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { VisibilitySelector } from '@/components/common/visibility-selector'
import { NewsDetail } from '@/components/news/news-detail'
import type { NewsDetailItem } from '@/components/news/news-detail'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'

type NewsType =
  | 'NEWS'
  | 'ANNOUNCEMENT'
  | 'EVENT'
  | 'BIRTHDAY'
  | 'HOLIDAY'
  | 'ALERT'
  | 'INTERNAL_AD'
  | 'RECOGNITION'
type NewsPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
type NewsStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

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

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administradores' },
  { value: 'TECHNICIAN', label: 'Técnicos' },
  { value: 'CLIENT', label: 'Clientes' },
]

interface NewsItem {
  id: string
  title: string
  slug: string
  content: string
  summary: string | null
  imageUrl: string | null
  type: NewsType
  priority: NewsPriority
  status: NewsStatus
  startDate: string | null
  endDate: string | null
  isFeatured: boolean
  allowComments: boolean
  allowReactions: boolean
  views: number
  createdById: string
  updatedById: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string; email: string }
  updatedBy: { id: string; name: string; email: string } | null
  news_roles: Array<{ id: string; role: string }>
  news_users: Array<{
    id: string
    userId: string
    user: { id: string; name: string; email: string }
  }>
  news_departments: Array<{
    id: string
    departmentId: string
    departments: { id: string; name: string }
  }>
  news_families?: Array<{
    id: string
    familyId: string
    families: { id: string; name: string }
  }>
  news_attachments?: Array<{
    id: string
    filename: string
    originalName: string
    path: string
  }>
  _count: { news_views: number; news_reactions: number; news_comments: number }
}

const typeLabels: Record<NewsType, string> = {
  NEWS: 'Noticia',
  ANNOUNCEMENT: 'Comunicado',
  EVENT: 'Evento',
  BIRTHDAY: 'Cumpleaños',
  HOLIDAY: 'Festividad',
  ALERT: 'Alerta',
  INTERNAL_AD: 'Publicidad Interna',
  RECOGNITION: 'Reconocimiento',
}

const priorityLabels: Record<NewsPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const statusLabels: Record<NewsStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Archivado',
}

const priorityColors: Record<NewsPriority, string> = {
  LOW: 'bg-gray-500',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500',
}

export default function AdminNewsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const accessChecked = useRef(false)

  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null)
  const [deletingNews, setDeletingNews] = useState<NewsItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    imageUrl: '',
    type: 'NEWS' as NewsType,
    priority: 'MEDIUM' as NewsPriority,
    status: 'DRAFT' as NewsStatus,
    startDate: null as Date | null,
    endDate: null as Date | null,
    isFeatured: false,
    allowComments: false,
    allowReactions: true,
    roles: [] as string[],
    userIds: [] as string[],
    departmentIds: [] as string[],
    familyIds: [] as string[],
  })

  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    type: 'all',
  })

  // Estados para búsqueda en selectores de visibilidad
  const [roleSearch, setRoleSearch] = useState('')
  const [familySearch, setFamilySearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [families, setFamilies] = useState<FamilyOption[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<
    Array<{ id: string; filename: string; url: string }>
  >([])
  const [uploadingImages, setUploadingImages] = useState(false)

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'noticias',
    title: 'Noticias y Comunicados',
    columns: [
      { key: 'title', label: 'Título' },
      { key: 'type', label: 'Tipo', format: (value: NewsType) => typeLabels[value] },
      {
        key: 'priority',
        label: 'Prioridad',
        format: (value: NewsPriority) => priorityLabels[value],
      },
      { key: 'status', label: 'Estado', format: (value: NewsStatus) => statusLabels[value] },
      { key: 'createdBy', label: 'Autor', format: (value: any) => value?.name || '' },
      {
        key: 'createdAt',
        label: 'Fecha de Creación',
        format: (value: string) => new Date(value).toLocaleDateString('es-EC'),
      },
      {
        key: 'views',
        label: 'Vistas',
        format: (_: any, row: NewsItem) => row._count?.news_views || 0,
      },
    ],
    getData: () => news,
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
      loadNews()
      loadUsersAndDepartments()
      return
    }

    const checkAccess = async () => {
      try {
        const res = await fetch(`/api/users/${session.user.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.user?.newsEnabled) {
            setHasAccess(true)
            loadNews()
            loadUsersAndDepartments()
            return
          }
        }
      } catch {}

      try {
        const res = await fetch(`/api/user/modules?_t=${Date.now()}`)
        if (res.ok) {
          const data = await res.json()
          if (data.news) {
            setHasAccess(true)
            loadNews()
            loadUsersAndDepartments()
            return
          }
        }
      } catch {}

      if ((session.user as any).newsEnabled) {
        setHasAccess(true)
        loadNews()
        loadUsersAndDepartments()
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

  const loadNews = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters.type && filters.type !== 'all') params.set('type', filters.type)
      if (filters.search) params.set('search', filters.search)

      const response = await fetch(`/api/admin/news?${params.toString()}`)
      if (!response.ok) throw new Error('Error al cargar noticias')
      const data = await response.json()
      setNews(data.news || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar noticias')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setUploadingImages(true)
      const url = editingNews ? `/api/admin/news/${editingNews.id}` : '/api/admin/news'
      const method = editingNews ? 'PUT' : 'POST'

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60_000)

      let response: Response
      try {
        response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            startDate: formData.startDate?.toISOString() || null,
            endDate: formData.endDate?.toISOString() || null,
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Error al guardar noticia')
      }
      const result = await response.json()
      const newsId = result.news?.id

      if (newsId && imageFiles.length > 0) {
        // Subir cada imagen una por una
        for (const file of imageFiles) {
          const imgFormData = new FormData()
          imgFormData.append('file', file)
          await fetch(`/api/admin/news/${newsId}/attachments`, {
            method: 'POST',
            body: imgFormData,
          })
        }
        // Si hay imágenes, usar la primera como imagen principal
        if (!editingNews) {
          const attachmentsRes = await fetch(`/api/admin/news/${newsId}/attachments`)
          if (attachmentsRes.ok) {
            const attachmentsData = await attachmentsRes.json()
            if (attachmentsData.attachments?.[0]) {
              const imageUrl = `/api/admin/news/${newsId}/attachments/${attachmentsData.attachments[0].id}/file`
              await fetch(`/api/admin/news/${newsId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl }),
              })
            }
          }
        }
      }

      toast({
        title: editingNews ? 'Noticia actualizada' : 'Noticia creada',
        description: 'La noticia se guardó correctamente',
        duration: 4000,
      })

      setShowCreateDialog(false)
      setEditingNews(null)
      setImageFiles([])
      setExistingAttachments([])
      resetForm()
      loadNews()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al guardar noticia',
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setUploadingImages(false)
    }
  }

  const handleEdit = async (item: NewsItem) => {
    setEditingNews(item)
    setFormData({
      title: item.title,
      content: item.content,
      summary: item.summary || '',
      imageUrl: item.imageUrl || '',
      type: item.type,
      priority: item.priority,
      status: item.status,
      startDate: item.startDate ? new Date(item.startDate) : null,
      endDate: item.endDate ? new Date(item.endDate) : null,
      isFeatured: item.isFeatured,
      allowComments: item.allowComments,
      allowReactions: item.allowReactions,
      roles: item.news_roles.map(r => r.role),
      userIds: item.news_users.map(u => u.userId),
      departmentIds: item.news_departments.map(d => d.departmentId),
      familyIds: (item as any).news_families?.map((f: any) => f.familyId) || [],
    })
    // Cargar attachments existentes
    try {
      const attachmentsRes = await fetch(`/api/admin/news/${item.id}/attachments`)
      if (attachmentsRes.ok) {
        const attachmentsData = await attachmentsRes.json()
        setExistingAttachments(
          (attachmentsData.attachments || []).map((a: any) => ({
            id: a.id,
            filename: a.filename,
            url: `/api/admin/news/${item.id}/attachments/${a.id}/file`,
          }))
        )
      }
    } catch (e) {
      setExistingAttachments([])
    }
    setShowCreateDialog(true)
  }

  const handleDelete = async () => {
    if (!deletingNews) return
    setDeleteLoading(true)
    try {
      const response = await fetch(`/api/admin/news/${deletingNews.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Error al eliminar noticia')

      toast({
        title: 'Noticia eliminada',
        description: 'La noticia se eliminó correctamente',
        duration: 4000,
      })

      setDeleteDialogOpen(false)
      setDeletingNews(null)
      loadNews()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al eliminar noticia',
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
      content: '',
      summary: '',
      imageUrl: '',
      type: 'NEWS',
      priority: 'MEDIUM',
      status: 'DRAFT',
      startDate: null,
      endDate: null,
      isFeatured: false,
      allowComments: false,
      allowReactions: true,
      roles: [],
      userIds: [],
      departmentIds: [],
      familyIds: [],
    })
  }

  const columns: Column<NewsItem>[] = [
    {
      key: 'title',
      label: 'Título',
      sortable: true,
      render: (item: NewsItem) => (
        <div className='space-y-1'>
          <div className='font-medium'>{item.title}</div>
          {item.summary && <div className='text-sm text-muted-foreground'>{item.summary}</div>}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (item: NewsItem) => <Badge variant='secondary'>{typeLabels[item.type]}</Badge>,
    },
    {
      key: 'priority',
      label: 'Prioridad',
      sortable: true,
      render: (item: NewsItem) => (
        <Badge className={priorityColors[item.priority]}>{priorityLabels[item.priority]}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      render: (item: NewsItem) => (
        <Badge variant={item.status === 'PUBLISHED' ? 'default' : 'secondary'}>
          {statusLabels[item.status]}
        </Badge>
      ),
    },
    {
      key: 'stats',
      label: 'Estadísticas',
      sortable: true,
      render: (item: NewsItem) => (
        <div className='flex gap-2 text-sm text-muted-foreground'>
          <span>👁 {item._count.news_views}</span>
          <span>👍 {item._count.news_reactions}</span>
          <span>💬 {item._count.news_comments}</span>
        </div>
      ),
    },
    {
      key: 'createdBy',
      label: 'Autor',
      sortable: true,
      render: (item: NewsItem) => item.createdBy.name,
    },
    {
      key: 'createdAt',
      label: 'Fecha',
      sortable: true,
      render: (item: NewsItem) => new Date(item.createdAt).toLocaleDateString('es-EC'),
    },
  ]

  const tableFilters = [
    {
      key: 'status',
      label: 'Estado',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'DRAFT', label: 'Borradores' },
        { value: 'PUBLISHED', label: 'Publicados' },
        { value: 'ARCHIVED', label: 'Archivados' },
      ],
    },
    {
      key: 'type',
      label: 'Tipo',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'Todos' },
        ...Object.entries(typeLabels).map(([value, label]) => ({ value, label })),
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
      title='Gestión de Noticias y Comunicados'
      subtitle='Administrar noticias, anuncios y comunicados internos'
      loading={loading && news.length === 0}
      headerActions={
        <Button
          size='sm'
          onClick={() => {
            resetForm()
            setEditingNews(null)
            setShowCreateDialog(true)
          }}
        >
          <Plus className='h-4 w-4 mr-2' />
          Nueva noticia
        </Button>
      }
    >
      <div className='space-y-4'>
        <DataTable
          title={`${news.length} noticia${news.length !== 1 ? 's' : ''}`}
          description='Todas las noticias del sistema'
          data={news}
          columns={columns}
          loading={loading}
          error={error}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={loadNews}
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
          onRowClick={item => {
            setSelectedNews(item)
          }}
          rowActions={item => {
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
                      setDeletingNews(item)
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
            icon: <Newspaper className='h-10 w-10 text-muted-foreground mx-auto mb-3' />,
            title: 'No hay noticias',
            description: 'No se encontraron noticias en el sistema',
            action: (
              <Button
                size='sm'
                onClick={() => {
                  resetForm()
                  setShowCreateDialog(true)
                }}
              >
                <Plus className='h-4 w-4 mr-2' />
                Crear primera noticia
              </Button>
            ),
          }}
        />
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className='sm:max-w-3xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingNews ? 'Editar noticia' : 'Nueva noticia'}</DialogTitle>
            <DialogDescription>
              Complete la información para {editingNews ? 'actualizar' : 'crear'} la noticia
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
                <Label>Resumen</Label>
                <Textarea
                  value={formData.summary}
                  onChange={e => setFormData({ ...formData, summary: e.target.value })}
                  rows={2}
                />
              </div>
              <div className='space-y-2 col-span-2'>
                <Label>Contenido</Label>
                <Textarea
                  required
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  rows={6}
                />
              </div>
              <div className='space-y-2'>
                <Label>Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={v => setFormData({ ...formData, type: v as NewsType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Prioridad</Label>
                <Select
                  value={formData.priority}
                  onValueChange={v => setFormData({ ...formData, priority: v as NewsPriority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={v => setFormData({ ...formData, status: v as NewsStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Imágenes (máx 5, opcional)</Label>
                <div className='space-y-3'>
                  <Input
                    type='file'
                    accept='image/*'
                    multiple
                    disabled={existingAttachments.length + imageFiles.length >= 5}
                    onChange={e => {
                      const files = Array.from(e.target.files || [])
                      const remainingSlots = 5 - existingAttachments.length - imageFiles.length
                      if (remainingSlots > 0) {
                        const newFiles = files.slice(0, remainingSlots)
                        setImageFiles([...imageFiles, ...newFiles])
                      }
                    }}
                  />
                  {/* Preview de archivos nuevos */}
                  {imageFiles.length > 0 && (
                    <div className='space-y-2'>
                      <p className='text-xs font-medium text-muted-foreground'>
                        Archivos para subir:
                      </p>
                      <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
                        {imageFiles.map((file, index) => (
                          <div key={index} className='relative group'>
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Preview ${index + 1}`}
                              className='w-full h-24 object-cover rounded-md border'
                            />
                            <button
                              type='button'
                              onClick={() =>
                                setImageFiles(imageFiles.filter((_, i) => i !== index))
                              }
                              className='absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity'
                            >
                              ×
                            </button>
                            <p className='text-[10px] text-muted-foreground truncate mt-1'>
                              {file.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Attachments existentes */}
                  {existingAttachments.length > 0 && (
                    <div className='space-y-2'>
                      <p className='text-xs font-medium text-muted-foreground'>
                        Imágenes actuales:
                      </p>
                      <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
                        {existingAttachments.map(attachment => (
                          <div key={attachment.id} className='relative group'>
                            <img
                              src={attachment.url}
                              alt={attachment.filename}
                              className='w-full h-24 object-cover rounded-md border'
                            />
                            <button
                              type='button'
                              onClick={() => {
                                if (!editingNews) return
                                fetch(
                                  `/api/admin/news/${editingNews.id}/attachments/${attachment.id}`,
                                  {
                                    method: 'DELETE',
                                  }
                                ).then(() => {
                                  setExistingAttachments(
                                    existingAttachments.filter(a => a.id !== attachment.id)
                                  )
                                })
                              }}
                              className='absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity'
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {existingAttachments.length + imageFiles.length === 0 && (
                    <Input
                      value={formData.imageUrl}
                      onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder='O pega una URL de imagen...'
                    />
                  )}
                  {existingAttachments.length + imageFiles.length >= 5 && (
                    <p className='text-xs text-amber-600'>✓ Límite de 5 imágenes alcanzado</p>
                  )}
                </div>
              </div>
              <div className='space-y-2'>
                <Label>Fecha de inicio (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      className='w-full justify-start text-left font-normal'
                    >
                      <CalendarIcon className='mr-2 h-4 w-4' />
                      {formData.startDate
                        ? format(formData.startDate, 'PPP', { locale: es })
                        : 'Seleccionar fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0'>
                    <Calendar
                      mode='single'
                      selected={formData.startDate}
                      onSelect={date => setFormData({ ...formData, startDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className='space-y-2'>
                <Label>Fecha de fin (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      className='w-full justify-start text-left font-normal'
                    >
                      <CalendarIcon className='mr-2 h-4 w-4' />
                      {formData.endDate
                        ? format(formData.endDate, 'PPP', { locale: es })
                        : 'Seleccionar fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0'>
                    <Calendar
                      mode='single'
                      selected={formData.endDate}
                      onSelect={date => setFormData({ ...formData, endDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className='space-y-4 pt-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Switch
                    checked={formData.isFeatured}
                    onCheckedChange={v => setFormData({ ...formData, isFeatured: v })}
                  />
                  <Label>Destacado</Label>
                </div>
                <div className='flex items-center gap-2'>
                  <Switch
                    checked={formData.allowComments}
                    onCheckedChange={v => setFormData({ ...formData, allowComments: v })}
                  />
                  <Label>Permitir comentarios</Label>
                </div>
                <div className='flex items-center gap-2'>
                  <Switch
                    checked={formData.allowReactions}
                    onCheckedChange={v => setFormData({ ...formData, allowReactions: v })}
                  />
                  <Label>Permitir reacciones</Label>
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
                  setEditingNews(null)
                  setImageFiles([])
                  setExistingAttachments([])
                }}
              >
                Cancelar
              </Button>
              <Button type='submit' disabled={uploadingImages}>
                {uploadingImages ? 'Guardando...' : editingNews ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {selectedNews && (
        <NewsDetail
          news={selectedNews as unknown as NewsDetailItem}
          isOpen={!!selectedNews}
          onClose={() => setSelectedNews(null)}
          mode='manage'
          onEdit={item => {
            setSelectedNews(null)
            handleEdit(item as unknown as NewsItem)
          }}
          onDelete={item => {
            setSelectedNews(null)
            setDeletingNews(item as unknown as NewsItem)
            setDeleteDialogOpen(true)
          }}
        />
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className='sm:max-w-[425px]' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>¿Eliminar noticia?</DialogTitle>
            <DialogDescription>
              {deletingNews && (
                <>
                  Estás a punto de eliminar:{' '}
                  <span className='font-semibold'>{deletingNews.title}</span>
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
