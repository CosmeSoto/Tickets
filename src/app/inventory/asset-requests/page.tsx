'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { AssetRequestList } from '@/components/inventory/asset-requests/asset-request-list'
import { Plus, Search, RefreshCw, Filter } from 'lucide-react'
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
  slaDeadline?: string | null
}

interface ListResponse {
  data: AssetRequest[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function AssetRequestsPage() {
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

  useEffect(() => {
    loadRequests()
  }, [page, statusFilter, typeFilter])

  const handleSearch = () => {
    setPage(1)
    loadRequests()
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  return (
    <div className='container mx-auto py-6 space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Mis Solicitudes de Activos</h1>
          <p className='text-muted-foreground'>
            Gestiona tus solicitudes de equipos, licencias y mantenimiento
          </p>
        </div>
        <div className='flex gap-2'>
          <Button onClick={loadRequests} variant='outline' disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Link href='/inventory/asset-requests/create'>
            <Button>
              <Plus className='mr-2 h-4 w-4' />
              Nueva Solicitud
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Filter className='h-5 w-5' />
            Filtros
          </CardTitle>
          <CardDescription>Filtra y busca tus solicitudes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            {/* Búsqueda */}
            <div className='md:col-span-2'>
              <div className='flex gap-2'>
                <div className='relative flex-1'>
                  <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
                  <Input
                    placeholder='Buscar por código o descripción...'
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

            {/* Filtro de Estado */}
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder='Estado' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos los estados</SelectItem>
                  <SelectItem value='PENDING'>Pendiente</SelectItem>
                  <SelectItem value='UNDER_REVIEW'>En Revisión</SelectItem>
                  <SelectItem value='APPROVED'>Aprobada</SelectItem>
                  <SelectItem value='REJECTED'>Rechazada</SelectItem>
                  <SelectItem value='FULFILLED'>Cumplida</SelectItem>
                </SelectContent>
              </Select>
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

      {/* Lista de Solicitudes */}
      <Card>
        <CardHeader>
          <CardTitle>Solicitudes ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetRequestList
            requests={requests}
            total={total}
            page={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            isLoading={isLoading}
            baseUrl='/inventory/asset-requests'
          />
        </CardContent>
      </Card>
    </div>
  )
}
