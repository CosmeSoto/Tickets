'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Filter, Loader2, Package, X } from 'lucide-react'
import { SystemLogo } from '@/components/common/system-logo'
import { useSystemLogo } from '@/hooks/use-system-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GroupedEquipmentCard } from '@/components/inventory/public/GroupedEquipmentCard'
import { UnitsListSheet } from '@/components/inventory/public/UnitsListSheet'
import type { EquipmentGroup } from '@/types/equipment-grouping'

interface Family {
  id: string
  name: string
  icon: string | null
  color: string | null
  types: { id: string; name: string }[]
}

interface FiltersData {
  families: Family[]
}

/**
 * PublicForSalePage — Página pública de listado completo de activos en venta
 *
 * Ruta: /verify/equipment/for-sale
 * Acceso: Sin autenticación requerida
 *
 * Funcionalidad:
 * - Header público con logo, enlace "Iniciar sesión" y botón "← Volver" a la landing
 * - Al montar: llamar a `/filters` y `/assets-for-sale` en paralelo
 * - Panel de filtros con selectores de Familia, Tipo de equipo (filtrado por familia) y Condición
 * - Filtrado client-side sobre el array en memoria al cambiar filtros
 * - Grid de tarjetas GroupedEquipmentCard con agrupación por modelo
 * - Sheet con lista de unidades individuales al hacer clic en "Ver unidades disponibles"
 * - Estado vacío cuando no hay equipos FOR_SALE
 *
 * Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */
export default function PublicForSalePage() {
  const { companyName } = useSystemLogo()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<EquipmentGroup[]>([])
  const [filters, setFilters] = useState<FiltersData>({ families: [] })
  const [selectedGroup, setSelectedGroup] = useState<EquipmentGroup | null>(null)
  const [unitsSheetOpen, setUnitsSheetOpen] = useState(false)

  // Estados de filtros
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [selectedCondition, setSelectedCondition] = useState<string>('')

  // Cargar datos al montar
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Llamadas en paralelo
        const [filtersRes, groupsRes] = await Promise.all([
          fetch('/api/public/assets-for-sale/filters'),
          fetch('/api/public/assets-for-sale'),
        ])

        const filtersData = await filtersRes.json()
        const groupsData = await groupsRes.json()

        setFilters(filtersData)
        setGroups(groupsData.items ?? [])
      } catch (error) {
        console.error('Error al cargar datos:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filtrado client-side
  const filteredGroups = groups.filter(group => {
    if (selectedFamilyId && group.type.family?.id !== selectedFamilyId) return false
    if (selectedTypeId && group.type.id !== selectedTypeId) return false
    if (selectedCondition && group.condition !== selectedCondition) return false
    return true
  })

  // Tipos disponibles según la familia seleccionada
  const availableTypes = selectedFamilyId
    ? (filters.families.find(f => f.id === selectedFamilyId)?.types ?? [])
    : filters.families.flatMap(f => f.types)

  // Agrupar por familia cuando no hay filtro de familia activo
  const groupedByFamily: Record<string, EquipmentGroup[]> = {}
  if (!selectedFamilyId) {
    filteredGroups.forEach(group => {
      const familyName = group.type.family?.name ?? 'Sin familia'
      if (!groupedByFamily[familyName]) {
        groupedByFamily[familyName] = []
      }
      groupedByFamily[familyName].push(group)
    })
  }

  // Limpiar todos los filtros
  const clearFilters = () => {
    setSelectedFamilyId('')
    setSelectedTypeId('')
    setSelectedCondition('')
  }

  const hasActiveFilters = selectedFamilyId || selectedTypeId || selectedCondition

  // Contar total de unidades disponibles
  const totalUnits = filteredGroups.reduce((sum, group) => sum + group.availableUnits, 0)

  // Handler para abrir el Sheet con la lista de unidades
  const handleViewDetails = (group: EquipmentGroup) => {
    setSelectedGroup(group)
    setUnitsSheetOpen(true)
  }

  // Handler para contacto general (tracking opcional)
  const handleContactGeneral = (group: EquipmentGroup) => {
    console.log('Contacto general para grupo:', group.groupId)
  }

  // Handler para contacto de unidad específica (tracking opcional)
  const handleContactUnit = (unit: any) => {
    console.log('Contacto para unidad:', unit.code)
  }

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background'>
        <div className='text-center'>
          <Loader2 className='h-10 w-10 animate-spin text-primary mx-auto mb-3' />
          <p className='text-sm text-muted-foreground'>Cargando equipos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-background flex flex-col'>
      {/* ── Header Público ─────────────────────────────────────────────── */}
      <header className='bg-card border-b border-border sticky top-0 z-40 shadow-sm'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center h-16 sm:h-20'>
            <div className='flex items-center gap-4'>
              <Button asChild variant='ghost' size='sm'>
                <Link href='/'>
                  <ArrowLeft className='h-4 w-4 mr-2' />
                  Volver
                </Link>
              </Button>
              <SystemLogo size='lg' showText={true} />
            </div>
            <nav className='flex items-center gap-2 sm:gap-3'>
              <Button asChild variant='default' size='sm'>
                <Link href='/login'>Iniciar Sesión</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className='relative py-12 sm:py-16 overflow-hidden bg-gradient-to-br from-primary/[0.08] via-background to-primary/[0.04]'>
        <div className='absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/[0.07] blur-3xl pointer-events-none' />
        <div className='absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/[0.06] blur-3xl pointer-events-none' />
        <div className='absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent' />

        <div className='relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
          <div className='inline-flex items-center gap-2 bg-primary/10 border border-primary/25 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6'>
            <span className='w-2 h-2 rounded-full bg-primary animate-pulse' />
            Equipos disponibles
          </div>

          <h1 className='text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground leading-tight'>
            Equipos para la <span className='text-primary'>Venta</span>
          </h1>
          <p className='text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto'>
            Explora nuestro catálogo de equipos de calidad disponibles para la venta
          </p>
        </div>
      </section>

      {/* ── Contenido Principal ────────────────────────────────────────── */}
      <section className='flex-1 py-12'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          {/* Panel de Filtros */}
          <Card className='mb-8'>
            <CardContent className='p-6'>
              <div className='flex items-center gap-2 mb-4'>
                <Filter className='h-5 w-5 text-muted-foreground' />
                <h2 className='text-lg font-semibold'>Filtros</h2>
                {hasActiveFilters && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={clearFilters}
                    className='ml-auto text-xs'
                  >
                    <X className='h-3 w-3 mr-1' />
                    Limpiar filtros
                  </Button>
                )}
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                {/* Filtro de Familia */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium text-foreground'>Familia</label>
                  <Select
                    value={selectedFamilyId}
                    onValueChange={value => {
                      const newFamilyId = value === 'all' ? '' : value
                      setSelectedFamilyId(newFamilyId)

                      // Lógica de cascada: si se selecciona una familia diferente,
                      // verificar si el tipo actual pertenece a la nueva familia
                      if (newFamilyId && selectedTypeId) {
                        const newFamily = filters.families.find(f => f.id === newFamilyId)
                        const typeExistsInNewFamily = newFamily?.types.some(
                          t => t.id === selectedTypeId
                        )

                        // Si el tipo actual no pertenece a la nueva familia, limpiarlo
                        if (!typeExistsInNewFamily) {
                          setSelectedTypeId('')
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Todas las familias' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Todas las familias</SelectItem>
                      {filters.families.map(family => (
                        <SelectItem key={family.id} value={family.id}>
                          {family.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Tipo de Equipo */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium text-foreground'>Tipo de equipo</label>
                  <Select
                    value={selectedTypeId}
                    onValueChange={value => {
                      setSelectedTypeId(value === 'all' ? '' : value)
                    }}
                    disabled={availableTypes.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Todos los tipos' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Todos los tipos</SelectItem>
                      {availableTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Condición */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium text-foreground'>Condición</label>
                  <Select
                    value={selectedCondition}
                    onValueChange={value => {
                      setSelectedCondition(value === 'all' ? '' : value)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Todas las condiciones' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Todas las condiciones</SelectItem>
                      <SelectItem value='NEW'>Nuevo</SelectItem>
                      <SelectItem value='USED'>Usado</SelectItem>
                      <SelectItem value='DAMAGED'>Dañado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contador de resultados */}
              <div className='mt-4 pt-4 border-t border-border'>
                <p className='text-sm text-muted-foreground'>
                  {filteredGroups.length === 0
                    ? 'No se encontraron equipos'
                    : `${filteredGroups.length} ${filteredGroups.length === 1 ? 'modelo' : 'modelos'} • ${totalUnits} ${totalUnits === 1 ? 'unidad disponible' : 'unidades disponibles'}`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Grid de Tarjetas */}
          {filteredGroups.length === 0 ? (
            // Estado vacío
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
                <div className='rounded-full bg-muted p-6 mb-4'>
                  <Package className='h-12 w-12 text-muted-foreground' />
                </div>
                <h3 className='text-xl font-semibold mb-2'>No hay equipos disponibles</h3>
                <p className='text-muted-foreground max-w-md mb-6'>
                  {hasActiveFilters
                    ? 'No se encontraron equipos que coincidan con los filtros seleccionados. Intenta ajustar los filtros.'
                    : 'Actualmente no hay equipos disponibles para la venta. Vuelve pronto para ver nuevas ofertas.'}
                </p>
                {hasActiveFilters && (
                  <Button onClick={clearFilters} variant='outline'>
                    Limpiar filtros
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : selectedFamilyId ? (
            // Vista sin agrupar por familia (cuando hay filtro de familia activo)
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              {filteredGroups.map(group => (
                <GroupedEquipmentCard
                  key={group.groupId}
                  group={group}
                  onViewDetails={handleViewDetails}
                  onContactGeneral={handleContactGeneral}
                />
              ))}
            </div>
          ) : (
            // Vista agrupada por familia (cuando no hay filtro de familia)
            <div className='space-y-12'>
              {Object.entries(groupedByFamily).map(([familyName, familyGroups]) => (
                <div key={familyName}>
                  {/* Encabezado de familia */}
                  <div className='flex items-center gap-3 mb-6'>
                    <div className='h-px flex-1 bg-border' />
                    <Badge variant='outline' className='text-base px-4 py-1.5'>
                      {familyName}
                    </Badge>
                    <div className='h-px flex-1 bg-border' />
                  </div>

                  {/* Grid de equipos de esta familia */}
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                    {familyGroups.map(group => (
                      <GroupedEquipmentCard
                        key={group.groupId}
                        group={group}
                        onViewDetails={handleViewDetails}
                        onContactGeneral={handleContactGeneral}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Sheet de Lista de Unidades ────────────────────────────────── */}
      {selectedGroup && (
        <UnitsListSheet
          group={selectedGroup}
          open={unitsSheetOpen}
          onClose={() => setUnitsSheetOpen(false)}
          onContactUnit={handleContactUnit}
        />
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className='bg-card border-t border-border py-10 mt-12'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4'>
          <SystemLogo size='md' showText={true} className='justify-center' />
          <p className='text-sm text-muted-foreground'>
            © {new Date().getFullYear()} {companyName}
          </p>
        </div>
      </footer>
    </div>
  )
}
