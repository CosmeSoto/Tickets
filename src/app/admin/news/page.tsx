'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Newspaper, Trash2, Edit, Eye, CheckCircle2, XCircle } from 'lucide-react'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
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

  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'ADMIN' && !(session.user as any).isSuperAdmin) {
      router.push('/unauthorized')
      return
    }

    loadNews()
    loadUsersAndDepartments()
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
        // Agrupar departamentos por familia
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
      setNews(data.news)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar noticias')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setUploadingImage(true)
      const url = editingNews ? `/api/admin/news/${editingNews.id}` : '/api/admin/news'
      const method = editingNews ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          startDate: formData.startDate?.toISOString() || null,
          endDate: formData.endDate?.toISOString() || null,
        }),
      })

      if (!response.ok) throw new Error('Error al guardar noticia')
      const result = await response.json()
      const newsId = result.news?.id

      // Subir imagen si se seleccionó un archivo
      if (imageFile && newsId) {
        const imgFormData = new FormData()
        imgFormData.append('file', imageFile)
        const uploadRes = await fetch(`/api/admin/news/${newsId}/attachments`, {
          method: 'POST',
          body: imgFormData,
        })
        if (uploadRes.ok) {
          const attachment = await uploadRes.json()
          // Actualizar la noticia con la URL de la imagen subida
          const imageUrl = `/api/admin/news/${newsId}/attachments/${attachment.id}/file`
          await fetch(`/api/admin/news/${newsId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl }),
          })
        }
      }

      toast({
        title: editingNews ? 'Noticia actualizada' : 'Noticia creada',
        description: 'La noticia se guardó correctamente',
        duration: 4000,
      })

      setShowCreateDialog(false)
      setEditingNews(null)
      setImageFile(null)
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
      setUploadingImage(false)
    }
  }

  const handleEdit = (item: NewsItem) => {
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

  const columns = [
    {
      key: 'title',
      title: 'Título',
      render: (item: NewsItem) => (
        <div className='space-y-1'>
          <div className='font-medium'>{item.title}</div>
          {item.summary && <div className='text-sm text-muted-foreground'>{item.summary}</div>}
        </div>
      ),
    },
    {
      key: 'type',
      title: 'Tipo',
      render: (item: NewsItem) => <Badge variant='secondary'>{typeLabels[item.type]}</Badge>,
    },
    {
      key: 'priority',
      title: 'Prioridad',
      render: (item: NewsItem) => (
        <Badge className={priorityColors[item.priority]}>{priorityLabels[item.priority]}</Badge>
      ),
    },
    {
      key: 'status',
      title: 'Estado',
      render: (item: NewsItem) => (
        <Badge variant={item.status === 'PUBLISHED' ? 'default' : 'secondary'}>
          {statusLabels[item.status]}
        </Badge>
      ),
    },
    {
      key: 'stats',
      title: 'Estadísticas',
      render: (item: NewsItem) => (
        <div className='flex gap-2 text-sm text-muted-foreground'>
          <span>👁️ {item._count.news_views}</span>
          <span>👍 {item._count.news_reactions}</span>
          <span>💬 {item._count.news_comments}</span>
        </div>
      ),
    },
    {
      key: 'author',
      title: 'Autor',
      render: (item: NewsItem) => item.createdBy.name,
    },
    {
      key: 'date',
      title: 'Fecha',
      render: (item: NewsItem) => new Date(item.createdAt).toLocaleDateString('es-EC'),
    },
    {
      key: 'actions',
      title: 'Acciones',
      render: (item: NewsItem) => (
        <div className='flex gap-2'>
          <Button variant='ghost' size='sm' onClick={() => handleEdit(item)}>
            <Edit className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              setDeletingNews(item)
              setDeleteDialogOpen(true)
            }}
          >
            <Trash2 className='h-4 w-4 text-destructive' />
          </Button>
        </div>
      ),
    },
  ]

  if (!session || (session.user.role !== 'ADMIN' && !(session.user as any).isSuperAdmin)) {
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
        <div className='flex flex-wrap gap-4 items-center'>
          <Input
            placeholder='Buscar noticias...'
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className='max-w-sm'
          />
          <Select value={filters.status} onValueChange={v => setFilters({ ...filters, status: v })}>
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='Todos los estados' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos</SelectItem>
              <SelectItem value='DRAFT'>Borradores</SelectItem>
              <SelectItem value='PUBLISHED'>Publicados</SelectItem>
              <SelectItem value='ARCHIVED'>Archivados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.type} onValueChange={v => setFilters({ ...filters, type: v })}>
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='Todos los tipos' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos</SelectItem>
              {Object.entries(typeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={loadNews} variant='ghost'>
            Actualizar
          </Button>
        </div>

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
                <Label>Imagen (opcional)</Label>
                <div className='space-y-2'>
                  <Input
                    type='file'
                    accept='image/*'
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setImageFile(file)
                        setFormData({ ...formData, imageUrl: '' })
                      }
                    }}
                  />
                  {imageFile && (
                    <p className='text-xs text-muted-foreground'>
                      📎 {imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB) — se comprimirá
                      al guardar
                    </p>
                  )}
                  {!imageFile && (
                    <Input
                      value={formData.imageUrl}
                      onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder='O pega una URL de imagen...'
                    />
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

              <div className='space-y-4'>
                <h3 className='text-sm font-semibold'>Visibilidad</h3>
                <p className='text-xs text-muted-foreground'>
                  Selecciona quién puede ver esta noticia (si no seleccionas nada, se ve por todos)
                </p>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                  {/* Roles */}
                  <div className='space-y-2'>
                    <Label className='text-sm'>Por Roles</Label>
                    <Input
                      placeholder='Buscar rol...'
                      value={roleSearch}
                      onChange={e => setRoleSearch(e.target.value)}
                      className='mb-2'
                    />
                    <div className='space-y-2 border rounded-lg p-3 max-h-40 overflow-y-auto'>
                      {ROLE_OPTIONS.filter(role =>
                        role.label.toLowerCase().includes(roleSearch.toLowerCase())
                      ).map(role => (
                        <div key={role.value} className='flex items-center gap-2'>
                          <Checkbox
                            id={`role-${role.value}`}
                            checked={formData.roles.includes(role.value)}
                            onCheckedChange={checked => {
                              setFormData(prev => ({
                                ...prev,
                                roles: checked
                                  ? [...prev.roles, role.value]
                                  : prev.roles.filter(r => r !== role.value),
                              }))
                            }}
                          />
                          <Label htmlFor={`role-${role.value}`} className='text-sm cursor-pointer'>
                            {role.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Familias */}
                  <div className='space-y-2'>
                    <Label className='text-sm'>Por Familias</Label>
                    <Input
                      placeholder='Buscar familia...'
                      value={familySearch}
                      onChange={e => setFamilySearch(e.target.value)}
                      className='mb-2'
                    />
                    <div className='space-y-2 border rounded-lg p-3 max-h-40 overflow-y-auto'>
                      {families
                        .filter(family =>
                          family.name.toLowerCase().includes(familySearch.toLowerCase())
                        )
                        .map(family => (
                          <div key={family.id} className='space-y-1'>
                            <div className='flex items-center gap-2'>
                              <Checkbox
                                id={`family-${family.id}`}
                                checked={formData.familyIds.includes(family.id)}
                                onCheckedChange={checked => {
                                  setFormData(prev => ({
                                    ...prev,
                                    familyIds: checked
                                      ? [...prev.familyIds, family.id]
                                      : prev.familyIds.filter(id => id !== family.id),
                                  }))
                                }}
                              />
                              <Label
                                htmlFor={`family-${family.id}`}
                                className='text-sm cursor-pointer font-medium'
                              >
                                {family.name}
                              </Label>
                            </div>
                            {/* Departamentos de esta familia */}
                            {family.departments.length > 0 && (
                              <div className='ml-6 space-y-1'>
                                {family.departments.map(dept => (
                                  <div key={dept.id} className='flex items-center gap-2'>
                                    <Checkbox
                                      id={`dept-${dept.id}`}
                                      checked={formData.departmentIds.includes(dept.id)}
                                      onCheckedChange={checked => {
                                        setFormData(prev => ({
                                          ...prev,
                                          departmentIds: checked
                                            ? [...prev.departmentIds, dept.id]
                                            : prev.departmentIds.filter(id => id !== dept.id),
                                        }))
                                      }}
                                    />
                                    <Label
                                      htmlFor={`dept-${dept.id}`}
                                      className='text-sm cursor-pointer text-muted-foreground'
                                    >
                                      {dept.name}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Usuarios */}
                  <div className='space-y-2 lg:col-span-2'>
                    <Label className='text-sm'>Por Usuarios</Label>
                    <Input
                      placeholder='Buscar usuario...'
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className='mb-2'
                    />
                    <div className='space-y-2 border rounded-lg p-3 max-h-40 overflow-y-auto grid grid-cols-2 gap-2'>
                      {users
                        .filter(
                          user =>
                            user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                            user.email.toLowerCase().includes(userSearch.toLowerCase())
                        )
                        .map(user => (
                          <div key={user.id} className='flex items-center gap-2'>
                            <Checkbox
                              id={`user-${user.id}`}
                              checked={formData.userIds.includes(user.id)}
                              onCheckedChange={checked => {
                                setFormData(prev => ({
                                  ...prev,
                                  userIds: checked
                                    ? [...prev.userIds, user.id]
                                    : prev.userIds.filter(id => id !== user.id),
                                }))
                              }}
                            />
                            <Label
                              htmlFor={`user-${user.id}`}
                              className='text-sm cursor-pointer truncate'
                            >
                              {user.name}
                            </Label>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setShowCreateDialog(false)
                  setEditingNews(null)
                }}
              >
                Cancelar
              </Button>
              <Button type='submit'>{editingNews ? 'Actualizar' : 'Crear'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
