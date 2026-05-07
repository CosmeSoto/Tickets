'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AssetRequestList } from '@/components/inventory/asset-requests/asset-request-list'
import { Search, RefreshCw, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { AssetRequestStatus, AssetType } from '@prisma/client'

interface AssetRequest {
  id: string
  code: string
  assetType: AssetType
  description: string
  familyId: string
  familyName: string
  status: AssetRequestStatus
  requesterId: string
  requesterName: string
  createdAt: string
  updatedAt: string
}

interface ListResponse {
  data: AssetRequest[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function AdminAssetRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<AssetRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('all')

  // Estadísticas
  const [stats, setStats] = useState({
    pending: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    fulfilled: 0,
  })

  const loadRequests = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (search) params.append('search', search)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (typeFilter !== 'all') params.append('assetType', typeFilter)

      // Filtro por tab
      if (activeTab !== 'all') {
        params.set('status', activeTab.toUpperCase())
      }

      const response = await fetch(`/api/inventory/asset-requests?${params}`)
      if (!response.ok) {
        throw new Error('Error al cargar solicitudes')
      }

      const data: ListResponse = await response.json()
      setRequests(data.data)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar solicitudes')
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/inventory/asset-requests?limit=1000')
      if (response.ok) {
        const data: ListResponse = await response.json()
        const allRequests = data.data

        setStats({
          pending: allRequests.filter(r => r.status === 'PENDING').length,
          underReview: allRequests.filter(r => r.status === 'UNDER_REVIEW').length,
          approved: allRequests.filter(r => r.status === 'APPROVED').length,
          rejected: allRequests.filter(r => r.status === 'REJECTED').length,
          fulfilled: allRequests.filter(r => r.status === 'FULFILLED').length,
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  useEffect(() => {
    loadRequests()
    loadStats()
  }, [page, statusFilter, typeFilter, activeTab])

  const handleSearch = () => {
    setPage(1)
    loadRequests()
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setPage(1)
  }

  return (
    <div className='container mx-auto py-6 space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Gestión de Solicitudes de Activos</h1>
          <p className='text-muted-foreground'>
            Administra todas las solicitudes de equipos, licencias y mantenimiento
          </p>
        </div>
        <Button
          onClick={() => {
            loadRequests()
            loadStats()
          }}
          variant='outline'
          disabled={isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Estadísticas */}
      <div className='grid gap-4 md:grid-cols-5'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>En Revisión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.underReview}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Aprobadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Rechazadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.rejected}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Cumplidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.fulfilled}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Filter className='h-5 w-5' />
            Filtros
          </CardTitle>
          <CardDescription>Filtra y busca solicitudes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            {/* Búsqueda */}
            <div className='md:col-span-1'>
              <div className='flex gap-2'>
                <div className='relative flex-1'>
                  <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
                  <Input
                    placeholder='Buscar...'
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className='pl-8'
                  />
                </div>
                <Button onClick={handleSearch} disabled={isLoading}>
                  Buscar
                </Button>
              </div>
            </div>

            {/* Filtro de Tipo */}
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder='Tipo' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos los tipos</SelectItem>
                  <SelectItem value='EQUIPMENT'>Equipo</SelectItem>
                  <SelectItem value='LICENSE'>Licencia</SelectItem>
                  <SelectItem value='MAINTENANCE'>Mantenimiento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs por Estado */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value='all'>Todas ({total})</TabsTrigger>
          <TabsTrigger value='pending'>Pendientes ({stats.pending})</TabsTrigger>
          <TabsTrigger value='under_review'>En Revisión ({stats.underReview})</TabsTrigger>
          <TabsTrigger value='approved'>Aprobadas ({stats.approved})</TabsTrigger>
          <TabsTrigger value='rejected'>Rechazadas ({stats.rejected})</TabsTrigger>
          <TabsTrigger value='fulfilled'>Cumplidas ({stats.fulfilled})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className='mt-6'>
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes</CardTitle>
            </CardHeader>
            <CardContent>
              <AssetRequestList
                requests={requests}
                total={total}
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                isLoading={isLoading}
                baseUrl='/admin/inventory/asset-requests'
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
