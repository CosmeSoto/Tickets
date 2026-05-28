'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FileText, Search, Download, ExternalLink } from 'lucide-react'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

interface CategoryOption {
  id: string
  name: string
}

interface FormItem {
  id: string
  title: string
  description?: string | null
  summary?: string | null
  version?: string | null
  category?: CategoryOption | null
  fileUrl?: string | null
  isFeatured: boolean
  downloadCount: number
  createdAt: string
}

export default function PublicFormsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const accessChecked = useRef(false)

  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [forms, setForms] = useState<FormItem[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
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
      const dest = session.user.role === 'TECHNICIAN' ? '/technician' : '/client'
      router.replace(dest)
    }

    checkAccess()
  }, [session, status, router])

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

  const loadForms = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.category && filters.category !== 'all') params.set('categoryId', filters.category)
      if (filters.search) params.set('search', filters.search)

      const response = await fetch(`/api/forms?${params.toString()}`)
      if (!response.ok) throw new Error('Error al cargar formularios')
      const data = await response.json()
      setForms(data.forms || [])
    } catch (err) {
      console.error('Error loading forms', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (form: FormItem) => {
    if (!form.fileUrl) {
      toast({
        title: 'Aviso',
        description: 'Este formulario no tiene un archivo adjunto',
        variant: 'destructive',
      })
      return
    }

    try {
      setDownloadingId(form.id)

      await fetch(`/api/forms/${form.id}/download`, {
        method: 'POST',
      })

      window.open(form.fileUrl, '_blank')

      toast({
        title: 'Descarga iniciada',
        description: `Descargando ${form.title}...`,
      })

      loadForms()
    } catch (err) {
      toast({
        title: 'Error',
        description: 'No se pudo descargar el formulario',
        variant: 'destructive',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  if (!session || hasAccess === null) {
    return null
  }

  if (hasAccess === false) {
    return null
  }

  return (
    <ModuleLayout
      title='Formularios y Documentos'
      subtitle='Accede a los formularios y documentos disponibles'
      loading={loading}
    >
      <div className='space-y-6'>
        <div className='flex flex-wrap gap-4 items-center'>
          <Input
            placeholder='Buscar formularios...'
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className='max-w-sm'
          />
          <Select
            value={filters.category}
            onValueChange={v => setFilters({ ...filters, category: v })}
          >
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='Todas las categorías' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todas</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={loadForms} variant='ghost'>
            Actualizar
          </Button>
        </div>

        {forms.filter(f => f.isFeatured).length > 0 && (
          <div className='space-y-3'>
            <h2 className='text-lg font-semibold'>Destacados</h2>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {forms
                .filter(f => f.isFeatured)
                .map(form => (
                  <Card
                    key={form.id}
                    className='border-primary/20 hover:shadow-md transition-shadow'
                  >
                    <CardHeader className='pb-2'>
                      <div className='flex items-start justify-between'>
                        <div className='flex items-center gap-3'>
                          <div className='bg-primary/10 p-2 rounded-lg'>
                            <FileText className='h-5 w-5 text-primary' />
                          </div>
                          <CardTitle className='text-lg'>{form.title}</CardTitle>
                        </div>
                        <Badge variant='default'>Destacado</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {form.description && (
                        <p className='text-sm text-muted-foreground mb-3'>{form.description}</p>
                      )}
                      {form.version && (
                        <Badge variant='outline' className='mb-3'>
                          v{form.version}
                        </Badge>
                      )}
                      <div className='flex items-center justify-between mb-3'>
                        {form.category && <Badge variant='secondary'>{form.category.name}</Badge>}
                        <span className='text-xs text-muted-foreground flex items-center gap-1'>
                          <Download className='h-3 w-3' />
                          {form.downloadCount}
                        </span>
                      </div>
                      {form.fileUrl && (
                        <Button
                          onClick={() => handleDownload(form)}
                          disabled={downloadingId === form.id}
                          className='w-full'
                        >
                          {downloadingId === form.id ? (
                            'Descargando...'
                          ) : (
                            <>
                              <Download className='h-4 w-4 mr-2' />
                              Descargar
                            </>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}

        <div className='space-y-3'>
          <h2 className='text-lg font-semibold'>Todos los formularios</h2>
          {forms.length === 0 ? (
            <div className='text-center py-12 bg-muted/20 rounded-lg border border-dashed'>
              <FileText className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
              <p className='text-muted-foreground'>
                No hay formularios disponibles en este momento
              </p>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {forms
                .filter(f => !f.isFeatured)
                .map(form => (
                  <Card key={form.id} className='hover:shadow-md transition-shadow'>
                    <CardHeader className='pb-2'>
                      <div className='flex items-start justify-between'>
                        <div className='flex items-center gap-3'>
                          <div className='bg-muted/50 p-2 rounded-lg'>
                            <FileText className='h-5 w-5 text-muted-foreground' />
                          </div>
                          <CardTitle className='text-base'>{form.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {form.description && (
                        <p className='text-sm text-muted-foreground mb-3'>{form.description}</p>
                      )}
                      {form.version && (
                        <Badge variant='outline' className='mb-3'>
                          v{form.version}
                        </Badge>
                      )}
                      <div className='flex items-center justify-between mb-3'>
                        {form.category && <Badge variant='secondary'>{form.category.name}</Badge>}
                        <span className='text-xs text-muted-foreground flex items-center gap-1'>
                          <Download className='h-3 w-3' />
                          {form.downloadCount}
                        </span>
                      </div>
                      {form.fileUrl && (
                        <Button
                          onClick={() => handleDownload(form)}
                          disabled={downloadingId === form.id}
                          className='w-full'
                          variant='outline'
                        >
                          {downloadingId === form.id ? (
                            'Descargando...'
                          ) : (
                            <>
                              <Download className='h-4 w-4 mr-2' />
                              Descargar
                            </>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </div>
    </ModuleLayout>
  )
}
