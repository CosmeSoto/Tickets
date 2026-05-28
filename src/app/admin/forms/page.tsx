'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { FileText, Plus, Search, Edit, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function FormsPage() {
  const { data: session } = useSession()
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/forms')
      .then(res => res.json())
      .then(data => {
        setForms(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filteredForms = forms.filter(
    form =>
      form.title.toLowerCase().includes(search.toLowerCase()) ||
      form.description?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
      </div>
    )
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='flex justify-between items-center mb-8'>
        <div>
          <h1 className='text-3xl font-bold text-foreground'>Formularios y Documentos</h1>
          <p className='text-muted-foreground mt-1'>
            Gestiona los formularios y documentos del sistema
          </p>
        </div>
        <Button>
          <Plus className='w-4 h-4 mr-2' />
          Nuevo Formulario
        </Button>
      </div>

      <div className='mb-6'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4' />
          <Input
            placeholder='Buscar formularios...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='pl-10'
          />
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {filteredForms.map(form => (
          <Card key={form.id} className='hover:shadow-lg transition-shadow'>
            <CardHeader className='pb-2'>
              <div className='flex justify-between items-start'>
                <div className='flex items-center gap-3'>
                  <div className='bg-primary/10 p-2 rounded-lg'>
                    <FileText className='w-5 h-5 text-primary' />
                  </div>
                  <CardTitle className='text-lg'>{form.title}</CardTitle>
                </div>
                <div className='flex gap-2'>
                  <Button variant='ghost' size='icon'>
                    <Edit className='w-4 h-4' />
                  </Button>
                  <Button variant='ghost' size='icon'>
                    <Trash2 className='w-4 h-4' />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-muted-foreground mb-3 line-clamp-2'>
                {form.description || 'Sin descripción'}
              </p>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  {form.isActive ? (
                    <Badge variant='default'>Activo</Badge>
                  ) : (
                    <Badge variant='secondary'>Inactivo</Badge>
                  )}
                  {form.isFeatured && <Badge variant='outline'>Destacado</Badge>}
                </div>
                <div className='text-sm text-muted-foreground'>{form.downloadCount} descargas</div>
              </div>
              {form.fileUrl && (
                <Button variant='outline' className='w-full mt-3'>
                  <Download className='w-4 h-4 mr-2' />
                  Descargar
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredForms.length === 0 && (
        <div className='text-center py-12'>
          <FileText className='w-16 h-16 mx-auto text-muted-foreground mb-4' />
          <h3 className='text-lg font-medium text-foreground mb-2'>No hay formularios</h3>
          <p className='text-muted-foreground'>
            {search
              ? 'Intenta con otro término de búsqueda'
              : 'Comienza creando un nuevo formulario'}
          </p>
        </div>
      )}
    </div>
  )
}
