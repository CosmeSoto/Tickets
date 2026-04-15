'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  FolderTree,
  Search,
  Ticket,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Eye,
} from 'lucide-react'

interface Category {
  id: string
  categoryId: string
  name: string
  description: string
  color: string
  levelName: string
  priority: number
  maxTickets: number | null
  autoAssign: boolean
  currentTickets: number
  utilization: number
  stats: {
    open: number
    inProgress: number
    resolved: number
    total: number
  }
}

export default function TechnicianCategoriesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'TECHNICIAN') {
      router.push('/unauthorized')
      return
    }

    loadCategories()
  }, [session, router])

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/technician/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      toast({
        title: 'Error al cargar categorías',
        description: 'No se pudieron cargar las categorías asignadas',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredCategories = categories.filter((category) =>
    (category.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (category.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  )

  const totalTickets = categories.reduce((sum, cat) => sum + (cat.stats?.total || 0), 0)
  const totalOpen = categories.reduce((sum, cat) => sum + (cat.stats?.open || 0), 0)
  const totalResolved = categories.reduce((sum, cat) => sum + (cat.stats?.resolved || 0), 0)

  if (isLoading) {
    return (
      <ModuleLayout title="Mis Categorías" subtitle="Categorías asignadas" loading={true}>
        <div />
      </ModuleLayout>
    )
  }

  return (
    <ModuleLayout
      title="Mis Categorías"
      subtitle={`${categories.length} categorías asignadas`}
    >
      <div className="space-y-6">
        <BackToTickets />
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tickets</p>
                  <p className="text-2xl font-bold text-foreground">{totalTickets}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Ticket className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Abiertos</p>
                  <p className="text-2xl font-bold text-foreground">{totalOpen}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resueltos</p>
                  <p className="text-2xl font-bold text-foreground">{totalResolved}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar categorías..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Categories List */}
        {filteredCategories.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FolderTree className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? 'No se encontraron categorías' : 'No tienes categorías asignadas'}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Contacta a tu administrador para que te asigne categorías'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCategories.map((category) => (
              <Card
                key={category.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/technician/tickets?category=${category.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color || '#6B7280' }}
                      />
                      <div>
                        <CardTitle className="text-base">{category.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {category.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {category.levelName}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-bold text-foreground">
                          {category.stats?.total || 0}
                        </p>
                      </div>
                      <div className="text-center p-2 bg-orange-50 rounded-lg">
                        <p className="text-xs text-orange-600">Abiertos</p>
                        <p className="text-lg font-bold text-orange-700">
                          {category.stats?.open || 0}
                        </p>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-600">Resueltos</p>
                        <p className="text-lg font-bold text-green-700">
                          {category.stats?.resolved || 0}
                        </p>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2 text-muted-foreground">
                        <Ticket className="h-4 w-4" />
                        <span>Tickets actuales: {category.currentTickets || 0}</span>
                      </div>
                      {category.maxTickets && (
                        <span className="text-xs text-muted-foreground">
                          Máx: {category.maxTickets}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Tasa de resolución</span>
                        <span>
                          {(category.stats?.total || 0) > 0
                            ? Math.round(((category.stats?.resolved || 0) / (category.stats?.total || 1)) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${
                              (category.stats?.total || 0) > 0
                                ? ((category.stats?.resolved || 0) / (category.stats?.total || 1)) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/technician/tickets?category=${category.id}`)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Tickets
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/technician/stats?category=${category.id}`)
                        }}
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
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
