'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, RefreshCw, Ticket, Package, Users, Settings } from 'lucide-react'
import { FamilyIcon } from '@/components/inventory/family-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { TabGeneral } from '@/components/families/tab-general'
import { TabTickets } from '@/components/families/tab-tickets'
import { TabInventario } from '@/components/families/tab-inventario'
import { TabPersonal } from '@/components/families/tab-personal'
import type { TicketFamilyConfig } from '@/components/families/tab-tickets'
import type { InventoryFamilyConfig } from '@/components/families/tab-inventario'
import type { TechnicianAssignment, ManagerAssignment, AdminAssignment } from '@/components/families/tab-personal'
import type { DepartmentData } from '@/hooks/use-departments'

// ---- Types ----

interface FamilyBase {
  id: string
  code: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  isActive: boolean
  order: number
  _count?: {
    departments?: number
    tickets?: number
    technicianFamilyAssignments?: number
    managerFamilies?: number
  }
}

interface FamilyUnifiedResponse {
  family: FamilyBase
  ticketConfig: TicketFamilyConfig | null
  inventoryConfig: InventoryFamilyConfig | null
  departments: DepartmentData[]
  technicians: TechnicianAssignment[]
  managers: ManagerAssignment[]
  admins: AdminAssignment[]
  currentUserIsSuperAdmin: boolean
}

const VALID_TABS = ['general', 'tickets', 'inventario', 'personal'] as const
type TabValue = (typeof VALID_TABS)[number]

function isValidTab(tab: string | null): tab is TabValue {
  return VALID_TABS.includes(tab as TabValue)
}

// ---- FamilyHeader ----

function FamilyHeader({ family }: { family: FamilyBase }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
            style={{ backgroundColor: family.color || '#6B7280' }}
          >
            <FamilyIcon icon={family.icon} color={family.color} code={family.code} className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">{family.name}</h2>
              <Badge variant="outline" className="font-mono">{family.code}</Badge>
              <Badge variant={family.isActive ? 'default' : 'secondary'}>
                {family.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {family.description && (
              <p className="text-sm text-muted-foreground mt-1">{family.description}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{family._count?.departments ?? 0}</p>
            <p className="text-xs text-blue-600 dark:text-blue-500">Departamentos</p>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{family._count?.tickets ?? 0}</p>
            <p className="text-xs text-orange-600 dark:text-orange-500">Tickets</p>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{family._count?.technicianFamilyAssignments ?? 0}</p>
            <p className="text-xs text-green-600 dark:text-green-500">Técnicos</p>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{family._count?.managerFamilies ?? 0}</p>
            <p className="text-xs text-purple-600 dark:text-purple-500">Managers</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Page ----

export default function FamilyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawTab = searchParams.get('tab')
  const activeTab: TabValue = isValidTab(rawTab) ? rawTab : 'general'

  const [data, setData] = useState<FamilyUnifiedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/families/${id}`)
      if (res.status === 404) {
        setError('Familia no encontrada')
        return
      }
      if (!res.ok) {
        setError('Error al cargar la familia')
        return
      }
      const json: FamilyUnifiedResponse = await res.json()
      setData(json)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`?${params.toString()}`)
  }

  const handleFamilyUpdated = (updated: FamilyBase) => {
    setData(prev => prev ? { ...prev, family: { ...prev.family, ...updated } } : prev)
  }

  const handleTicketConfigUpdated = (config: TicketFamilyConfig) => {
    setData(prev => prev ? { ...prev, ticketConfig: config } : prev)
  }

  const handleInventoryConfigUpdated = (config: InventoryFamilyConfig) => {
    setData(prev => prev ? { ...prev, inventoryConfig: config } : prev)
  }

  const handleDepartmentsChanged = async () => {
    // Reload only departments by re-fetching the unified endpoint
    try {
      const res = await fetch(`/api/admin/families/${id}`)
      if (res.ok) {
        const json: FamilyUnifiedResponse = await res.json()
        setData(json)
      }
    } catch {
      // silencioso
    }
  }

  return (
    <ModuleLayout
      title={data ? `Familia: ${data.family.name}` : 'Detalle de Familia'}
      subtitle={data ? `Código: ${data.family.code}` : undefined}
      loading={loading && !data}
      error={error}
      onRetry={loadData}
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/families')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      }
    >
      {data && (
        <div className="space-y-6">
          {/* Family header with badge, stats, color/icon */}
          <FamilyHeader family={data.family} />

          {/* Tabs — active state persisted in URL via ?tab= */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general" className="flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                General
              </TabsTrigger>
              <TabsTrigger value="tickets" className="flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5" />
                Tickets
              </TabsTrigger>
              <TabsTrigger value="inventario" className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Inventario
              </TabsTrigger>
              <TabsTrigger value="personal" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Personal
              </TabsTrigger>
            </TabsList>

            {/* Tab General — editable form + departments */}
            <TabsContent value="general">
              <TabGeneral
                family={data.family}
                departments={data.departments}
                onFamilyUpdated={handleFamilyUpdated}
                onDepartmentsChanged={handleDepartmentsChanged}
              />
            </TabsContent>

            {/* Tab Tickets — Req 3.1–3.5 */}
            <TabsContent value="tickets">
              <TabTickets
                familyId={id}
                ticketConfig={data.ticketConfig}
                onConfigUpdated={handleTicketConfigUpdated}
              />
            </TabsContent>

            {/* Tab Inventario — Req 4.1–4.5 */}
            <TabsContent value="inventario">
              <TabInventario
                familyId={id}
                inventoryConfig={data.inventoryConfig}
                onConfigUpdated={handleInventoryConfigUpdated}
              />
            </TabsContent>

            {/* Tab Personal — Req 5.1–5.9 */}
            <TabsContent value="personal">
              <TabPersonal
                familyId={id}
                technicians={data.technicians}
                managers={data.managers}
                admins={data.admins ?? []}
                currentUserIsSuperAdmin={data.currentUserIsSuperAdmin ?? false}
                onPersonnelChanged={handleDepartmentsChanged}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </ModuleLayout>
  )
}
