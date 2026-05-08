'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Settings } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { CustomFieldsManager } from '@/components/inventory/custom-fields/custom-fields-manager'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface Family {
  id: string
  name: string
  code: string
  color?: string
}

export default function CustomFieldsPage() {
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const [families, setFamilies] = useState<Family[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFamilies()
  }, [])

  const loadFamilies = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/inventory/families')
      if (!response.ok) throw new Error('Error al cargar familias')
      const data = await response.json()

      // El endpoint puede devolver un array o un objeto con propiedad families
      const familiesArray = Array.isArray(data) ? data : data.families || []
      setFamilies(familiesArray)

      // Seleccionar la primera familia por defecto
      if (familiesArray.length > 0 && !selectedFamilyId) {
        setSelectedFamilyId(familiesArray[0].id)
      }
    } catch (error) {
      console.error('Error loading families:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las familias de inventario',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
      </div>
    )
  }

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className='container mx-auto py-8'>
        <Card>
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
            <CardDescription>No tienes permisos para acceder a esta página</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className='container mx-auto py-8 space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Campos Personalizados</h1>
          <p className='text-muted-foreground mt-2'>
            Gestiona los atributos personalizados para cada familia de inventario
          </p>
        </div>
        <Button variant='outline' size='icon'>
          <Settings className='h-4 w-4' />
        </Button>
      </div>

      {/* Selector de Familia */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Familia</CardTitle>
          <CardDescription>
            Elige la familia de inventario para gestionar sus campos personalizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            <Label htmlFor='family'>Familia de Inventario</Label>
            <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
              <SelectTrigger id='family'>
                <SelectValue placeholder='Selecciona una familia' />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(families) && families.length > 0 ? (
                  families.map(family => (
                    <SelectItem key={family.id} value={family.id}>
                      <div className='flex items-center gap-2'>
                        {family.color && (
                          <div
                            className='w-3 h-3 rounded-full'
                            style={{ backgroundColor: family.color }}
                          />
                        )}
                        <span>{family.name}</span>
                        <span className='text-xs text-muted-foreground'>({family.code})</span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value='none' disabled>
                    No hay familias disponibles
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Gestor de Campos Personalizados */}
      {selectedFamilyId && (
        <Card>
          <CardHeader>
            <CardTitle>Campos Personalizados</CardTitle>
            <CardDescription>
              Define los atributos específicos que se mostrarán en el formulario de equipos de esta
              familia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CustomFieldsManager familyId={selectedFamilyId} />
          </CardContent>
        </Card>
      )}

      {/* Información */}
      <Card className='border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800'>
        <CardHeader>
          <CardTitle className='text-blue-900 dark:text-blue-100'>
            ℹ️ Información sobre Campos Personalizados
          </CardTitle>
        </CardHeader>
        <CardContent className='text-sm text-blue-800 dark:text-blue-200 space-y-2'>
          <p>
            <strong>¿Qué son los campos personalizados?</strong> Son atributos específicos que
            puedes definir para cada familia de inventario (Tecnología, Activos Fijos, Seguridad,
            etc.).
          </p>
          <p>
            <strong>Tipos de campos disponibles:</strong>
          </p>
          <ul className='list-disc list-inside ml-4 space-y-1'>
            <li>
              <strong>Texto:</strong> Para valores alfanuméricos (ej: marca, modelo, serie)
            </li>
            <li>
              <strong>Número:</strong> Para valores numéricos (ej: capacidad, voltaje, potencia)
            </li>
            <li>
              <strong>Selección:</strong> Para elegir entre opciones predefinidas (ej: tipo de
              disco, sistema operativo)
            </li>
            <li>
              <strong>Fecha:</strong> Para fechas específicas (ej: última revisión, próxima
              revisión)
            </li>
            <li>
              <strong>Booleano:</strong> Para valores sí/no (ej: visión nocturna, certificación)
            </li>
          </ul>
          <p>
            <strong>Uso:</strong> Los campos personalizados aparecerán automáticamente en el
            formulario de creación/edición de equipos cuando se seleccione un tipo de equipo que
            pertenezca a esta familia.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
