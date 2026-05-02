'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { useModuleData } from '@/hooks/common/use-module-data'
import { FolderTree, Search, Ticket, AlertCircle, CheckCircle, BarChart3, Eye } from 'lucide-react'

interface CategoryStats {
  open: number
  inProgress: number
  resolved: number
  total: number
}

interface TechnicianCategory {
  id: string
  categoryId: string
  name: string
  description: string
  color: string
  levelName: string
  categoryLevel: number
  parentId: string | null
  priority: number
  maxTickets: number | null
  autoAssign: boolean
  currentTickets: number
  utilization: number
  stats: CategoryStats
}

export default function TechnicianCategoriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const {
    data: categories,
    loading,
    error,
    reload,
  } = useModuleData<TechnicianCategory>({
    endpoint: '/api/technician/categories',
    initialLoad: true,
  })

  // Protección de ruta — sin redirect manual, ModuleLayout maneja el loading
  if (status === 'loading') return null
  if (!session || session.user.role !== 'TECHNICIAN') {
    if (typeof window !== 'undefined') router.push('/login')
    return null
  }

  const filteredCategories = categories.filter(
    cat =>
      (cat.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (cat.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  )

  const totalTickets = categories.reduce((sum, cat) => sum + (cat.stats?.total || 0), 0)
  const totalOpen = categories.reduce((sum, cat) => sum + (cat.stats?.open || 0), 0)
  const totalResolved = categories.reduce((sum, cat) => sum + (cat.stats?.resolved || 0), 0)

  return (
    <ModuleLayout
      title='Mis Categorías'
      subtitle={`${categories.length} categoría${categories.length !== 1 ? 's' : ''} asignada${categories.length !== 1 ? 's' : ''}`}
      loading={loading && categories.length === 0}
      error={error}
      onRetry={reload}
    >
      <div className='space-y-6'>
        <BackToTickets />

        {/* Summary Cards */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <SymmetricStatsCard
            title='Total Tickets'
            value={totalTickets}
            icon={Ticket}
            color='blue'
          />
          <SymmetricStatsCard
            title='Abiertos'
            value={totalOpen}
            icon={AlertCircle}
            color='orange'
            status={totalOpen > 10 ? 'warning' : 'normal'}
          />
          <SymmetricStatsCard
            title='Resueltos'
            value={totalResolved}
            icon={CheckCircle}
            color='green'
            status='success'
          />
        </div>

        {/* Search */}
        <Card>
          <CardContent className='p-4'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground' />
              <Input
                placeholder='Buscar categorías...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='pl-10'
              />
            </div>
          </CardContent>
        </Card>

        {/* Categories Grid */}
        {filteredCategories.length === 0 ? (
          <Card>
            <CardContent className='p-12 text-center'>
              <FolderTree className='h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50' />
              <h3 className='text-lg font-semibold text-foreground mb-2'>
                {searchQuery ? 'No se encontraron categorías' : 'No tienes categorías asignadas'}
              </h3>
              <p className='text-muted-foreground'>
                {searchQuery
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Contacta a tu administrador para que te asigne categorías'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {filteredCategories.map(category => (
              <Card
                key={category.id}
                className='hover:shadow-lg transition-shadow cursor-pointer bg-card'
                onClick={() => router.push(`/technician/tickets?category=${category.categoryId}`)}
              >
                <CardHeader className='pb-3'>
                  <div className='flex items-start justify-between'>
                    <div className='flex items-center space-x-3'>
                      <div
                        className='w-4 h-4 rounded-full flex-shrink-0'
                        style={{ backgroundColor: category.color || '#6B7280' }}
                      />
                      <div>
                        <CardTitle className='text-base'>{category.name}</CardTitle>
                        {category.description && (
                          <CardDescription className='text-xs mt-1'>
                            {category.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <Badge variant='outline' className='text-xs shrink-0'>
                      {category.levelName}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className='space-y-3'>
                    {/* Stats del área completa */}
                    <div className='grid grid-cols-3 gap-2'>
                      <div className='text-center p-2 bg-muted rounded-lg'>
                        <p className='text-xs text-muted-foreground'>Total área</p>
                        <p className='text-lg font-bold text-foreground'>
                          {category.stats?.total || 0}
                        </p>
                      </div>
                      <div className='text-center p-2 bg-orange-50 dark:bg-orange-500/10 rounded-lg'>
                        <p className='text-xs text-orange-600 dark:text-orange-400'>Abiertos</p>
                        <p className='text-lg font-bold text-orange-700 dark:text-orange-300'>
                          {category.stats?.open || 0}
                        </p>
                      </div>
                      <div className='text-center p-2 bg-green-50 dark:bg-green-500/10 rounded-lg'>
                        <p className='text-xs text-green-600 dark:text-green-400'>Resueltos</p>
                        <p className='text-lg font-bold text-green-700 dark:text-green-300'>
                          {category.stats?.resolved || 0}
                        </p>
                      </div>
                    </div>

                    {/* Mis tickets activos en esta categoría */}
                    <div className='flex items-center justify-between text-sm'>
                      <div className='flex items-center space-x-2 text-muted-foreground'>
                        <Ticket className='h-4 w-4' />
                        <span>Mis tickets activos: {category.currentTickets || 0}</span>
                      </div>
                      {category.maxTickets && (
                        <span className='text-xs text-muted-foreground'>
                          Máx: {category.maxTickets}
                        </span>
                      )}
                    </div>

                    {/* Tasa de resolución */}
                    <div>
                      <div className='flex items-center justify-between text-xs text-muted-foreground mb-1'>
                        <span>Tasa de resolución</span>
                        <span>
                          {(category.stats?.total || 0) > 0
                            ? Math.round(
                                ((category.stats?.resolved || 0) / (category.stats?.total || 1)) *
                                  100
                              )
                            : 0}
                          %
                        </span>
                      </div>
                      <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
                        <div
                          className='bg-green-600 dark:bg-green-500 h-2 rounded-full transition-all'
                          style={{
                            width: `${
                              (category.stats?.total || 0) > 0
                                ? ((category.stats?.resolved || 0) / (category.stats?.total || 1)) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className='flex items-center space-x-2 pt-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        className='flex-1'
                        onClick={e => {
                          e.stopPropagation()
                          router.push(`/technician/tickets?category=${category.categoryId}`)
                        }}
                      >
                        <Eye className='h-4 w-4 mr-2' />
                        Ver Tickets
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        className='flex-1'
                        onClick={e => {
                          e.stopPropagation()
                          router.push(`/technician/stats?category=${category.categoryId}`)
                        }}
                      >
                        <BarChart3 className='h-4 w-4 mr-2' />
                        Estadísticas
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ModuleLayout>
  )
}
