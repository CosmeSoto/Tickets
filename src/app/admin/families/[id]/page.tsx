'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, RefreshCw, Users, Settings } from 'lucide-react'
import { FamilyIcon } from '@/components/inventory/family-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { TabGeneral } from '@/components/families/tab-general'
import { TabPersonal } from '@/components/families/tab-personal'
import type {
  TechnicianAssignment,
  ManagerAssignment,
  AdminAssignment,
} from '@/components/families/tab-personal'
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
  departments: DepartmentData[]
  technicians: TechnicianAssignment[]
  managers: ManagerAssignment[]
  admins: AdminAssignment[]
  currentUserIsSuperAdmin: boolean
}

const VALID_TABS = ['general', 'personal'] as const
type TabValue = (typeof VALID_TABS)[number]

function isValidTab(tab: string | null): tab is TabValue {
  return VALID_TABS.includes(tab as TabValue)
}

// ---- FamilyHeader ----

function FamilyHeader({ family }: { family: FamilyBase }) {
  const stats = [
    { label: 'Departamentos', value: family._count?.departments ?? 0 },
    { label: 'Tickets', value: family._count?.tickets ?? 0 },
    { label: 'Técnicos', value: family._count?.technicianFamilyAssignments ?? 0 },
    { label: 'Managers', value: family._count?.managerFamilies ?? 0 },
  ]

  return (
    <Card>
      <CardContent className='pt-4 pb-4'>
        {/* Identity row */}
        <div className='flex items-center gap-3'>
          <div
            className='w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0'
            style={{ backgroundColor: family.color || '#6B7280' }}
          >
            <FamilyIcon
              icon={family.icon}
              color={family.color}
              code={family.code}
              className='w-5 h-5'
            />
          </div>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 flex-wrap'>
              <h2 className='text-base font-semibold truncate'>{family.name}</h2>
              <Badge variant='outline' className='font-mono text-xs'>
                {family.code}
              </Badge>
              <Badge variant={family.isActive ? 'default' : 'secondary'} className='text-xs'>
                {family.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {family.description && (
              <p className='text-xs text-muted-foreground mt-0.5 truncate'>{family.description}</p>
            )}
          </div>
        </div>

        {/* Stats row — compact, sin colores hardcodeados */}
        <div className='grid grid-cols-4 gap-2 mt-3'>
          {stats.map(s => (
            <div key={s.label} className='text-center py-2 px-1 bg-muted/50 rounded-md border'>
              <p className='text-lg font-bold tabular-nums'>{s.value}</p>
              <p className='text-[11px] text-muted-foreground leading-tight'>{s.label}</p>
            </div>
          ))}
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
    setData(prev => (prev ? { ...prev, family: { ...prev.family, ...updated } } : prev))
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
      title={data ? `${data.family.name}` : 'Detalle de Familia'}
      subtitle={
        <button
          onClick={() => router.push('/admin/families')}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <ArrowLeft className='h-3.5 w-3.5' />
          Familias
        </button>
      }
      loading={loading && !data}
      error={error}
      onRetry={loadData}
      headerActions={
        <Button variant='outline' size='sm' onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className='hidden sm:inline ml-2'>Recargar</span>
        </Button>
      }
    >
      {data && (
        <div className='space-y-6'>
          {/* Family header with badge, stats, color/icon */}
          <FamilyHeader family={data.family} />

          {/* Tabs — active state persisted in URL via ?tab= */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='general' className='flex items-center gap-1.5'>
                <Settings className='h-3.5 w-3.5' />
                General
              </TabsTrigger>
              <TabsTrigger value='personal' className='flex items-center gap-1.5'>
                <Users className='h-3.5 w-3.5' />
                Personal
              </TabsTrigger>
            </TabsList>

            {/* Tab General — editable form + departments */}
            <TabsContent value='general'>
              <TabGeneral
                family={data.family}
                departments={data.departments}
                onFamilyUpdated={handleFamilyUpdated}
                onDepartmentsChanged={handleDepartmentsChanged}
              />
            </TabsContent>

            {/* Tab Personal — Req 5.1–5.9 */}
            <TabsContent value='personal'>
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
