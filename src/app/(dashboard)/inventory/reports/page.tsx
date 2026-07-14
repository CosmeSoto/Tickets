'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  Crown,
  Lock,
  Sparkles,
  ArrowRight,
  LayoutGrid,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { useFamilyOptions } from '@/hooks/use-family-options'
import {
  REPORT_CATEGORIES,
  getVisibleTemplates,
  getVisibleDatasets,
  resolveUserReportRole,
} from '@/lib/inventory/reports/catalog'
import type { ReportTemplateDef } from '@/lib/inventory/reports/types'
import { getReportIcon } from '@/components/inventory/reports/report-icon-map'
import { SavedReportsPanel } from '@/components/inventory/reports/saved-reports-panel'
import { PinnedReportWidgets } from '@/components/inventory/reports/pinned-report-widgets'
import { ScheduledReportsPanel } from '@/components/inventory/reports/scheduled-reports-panel'

function getSubtitle(role: string, isSuperAdmin: boolean, canManage: boolean): string {
  if (isSuperAdmin) return 'Vista global — plantillas ejecutivas y explorador de datos'
  if (role === 'ADMIN') return 'Plantillas predefinidas y consultas flexibles por dataset'
  if (canManage) return 'Reportes del inventario de tus familias asignadas'
  return 'Reportes de inventario'
}

export default function InventoryReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const role = session?.user?.role ?? ''
  const isSuperAdmin = (session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin === true
  const canManageInventory = (session?.user as { canManageInventory?: boolean })?.canManageInventory === true

  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [scheduleReportId, setScheduleReportId] = useState<string | null>(null)
  const { families } = useFamilyOptions()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const userReportRole = useMemo(
    () => resolveUserReportRole(role, isSuperAdmin, canManageInventory),
    [role, isSuperAdmin, canManageInventory]
  )

  const templates = useMemo(() => getVisibleTemplates(userReportRole), [userReportRole])
  const datasets = useMemo(() => getVisibleDatasets(userReportRole), [userReportRole])

  const categories = useMemo(
    () =>
      REPORT_CATEGORIES.map(category => ({
        ...category,
        templates: templates.filter(t => t.categoryId === category.id),
        datasets: datasets.filter(d => d.categoryId === category.id),
      })).filter(c => c.templates.length > 0 || c.datasets.length > 0),
    [templates, datasets]
  )

  if (status === 'loading') {
    return (
      <ModuleLayout title='Centro de Reportes' loading>
        <div />
      </ModuleLayout>
    )
  }
  if (!session?.user) return null

  const navigateWithFamily = (path: string) => {
    const params = new URLSearchParams()
    if (selectedFamilyId) params.set('familyId', selectedFamilyId)
    const query = params.toString()
    router.push(`${path}${query ? `?${query}` : ''}`)
  }

  const handleTemplateClick = (slug: string) => navigateWithFamily(`/inventory/reports/${slug}`)
  const handleDatasetClick = (datasetId: string) =>
    navigateWithFamily(`/inventory/reports/explore?dataset=${datasetId}`)

  return (
    <ModuleLayout
      title='Centro de Reportes'
      subtitle={getSubtitle(role, isSuperAdmin, canManageInventory)}
    >
      <div className='space-y-8'>
        {/* Hero: Explorador */}
        <Card className='border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background'>
          <CardContent className='pt-6'>
            <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
              <div className='space-y-2'>
                <div className='flex items-center gap-2'>
                  <Sparkles className='h-5 w-5 text-primary' />
                  <h2 className='text-lg font-semibold'>Explorador de datos</h2>
                  <Badge variant='secondary'>{datasets.length} fuentes</Badge>
                </div>
                <p className='text-sm text-muted-foreground max-w-2xl'>
                  Más allá de las plantillas fijas: elige una fuente (equipos, contratos,
                  licencias…), aplica filtros, selecciona columnas y exporta. Modelo similar a
                  Snipe-IT o Freshservice.
                </p>
              </div>
              <Button size='lg' onClick={() => navigateWithFamily('/inventory/reports/explore')}>
                Abrir explorador
                <ArrowRight className='h-4 w-4 ml-2' />
              </Button>
            </div>
          </CardContent>
        </Card>

        <PinnedReportWidgets />

        <SavedReportsPanel onScheduleReport={id => setScheduleReportId(id)} />

        <ScheduledReportsPanel
          openCreateForReportId={scheduleReportId}
          onCreateDialogClose={() => setScheduleReportId(null)}
        />

        {/* Filtro global de familia */}
        {families.length > 1 && (
          <div className='flex flex-wrap items-center gap-3'>
            <p className='text-sm text-muted-foreground shrink-0'>Área por defecto:</p>
            <FamilyCombobox
              families={families.map(f => ({
                id: f.id,
                name: f.name,
                code: f.name.slice(0, 3).toUpperCase(),
                color: f.color,
              }))}
              value={selectedFamilyId ?? 'all'}
              onValueChange={v => setSelectedFamilyId(v === 'all' ? null : v)}
              allowAll
              allowClear
              popoverWidth='260px'
              className='w-full sm:w-56'
            />
            {isSuperAdmin && (
              <Badge className='bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1'>
                <Crown className='h-3 w-3' />
                Vista global
              </Badge>
            )}
          </div>
        )}

        {/* Categorías */}
        {categories.map(category => (
          <section key={category.id} className='space-y-4'>
            <div>
              <h3 className='text-base font-semibold flex items-center gap-2'>
                <LayoutGrid className='h-4 w-4 text-muted-foreground' />
                {category.name}
              </h3>
              <p className='text-sm text-muted-foreground'>{category.description}</p>
            </div>

            {category.templates.length > 0 && (
              <div className='space-y-2'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  Plantillas ejecutivas
                </p>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                  {category.templates.map((report: ReportTemplateDef) => {
                    const Icon = getReportIcon(report.icon)
                    return (
                      <Card
                        key={report.slug}
                        className={`cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group ${
                          report.superAdminOnly ? 'border-amber-200 dark:border-amber-800' : ''
                        }`}
                        onClick={() => handleTemplateClick(report.slug)}
                      >
                        <CardHeader className='pb-2'>
                          <div className='flex items-start gap-3'>
                            <div className='p-2 rounded-lg bg-muted group-hover:bg-primary/10 shrink-0'>
                              <Icon className='h-4 w-4 text-primary' />
                            </div>
                            <div className='min-w-0'>
                              <CardTitle className='text-sm leading-tight'>{report.name}</CardTitle>
                              {report.superAdminOnly && (
                                <Badge className='mt-1 text-xs' variant='outline'>
                                  <Crown className='h-2.5 w-2.5 mr-1' />
                                  Super Admin
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className='pt-0'>
                          <CardDescription className='text-xs line-clamp-2'>
                            {report.description}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}

            {category.datasets.length > 0 && (
              <div className='space-y-2'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  Datasets explorables
                </p>
                <div className='flex flex-wrap gap-2'>
                  {category.datasets.map(ds => {
                    const Icon = getReportIcon(ds.icon)
                    return (
                      <Button
                        key={ds.id}
                        variant='outline'
                        size='sm'
                        className='gap-2'
                        onClick={() => handleDatasetClick(ds.id)}
                      >
                        <Icon className='h-3.5 w-3.5' />
                        {ds.name}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        ))}

        {/* Nota */}
        <div className='flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4'>
          <BarChart3 className='h-4 w-4 mt-0.5 shrink-0' />
          <div className='space-y-1'>
            <p>
              <strong>Plantillas</strong> = reportes ejecutivos prearmados (KPIs + tabla).
              <strong className='ml-2'>Explorador</strong> = consultas ad hoc con filtros y
              columnas configurables.
            </p>
            {!isSuperAdmin && role !== 'ADMIN' && (
              <p className='flex items-center gap-1'>
                <Lock className='h-3 w-3' />
                Los datos están limitados a las familias que tienes asignadas.
              </p>
            )}
          </div>
        </div>
      </div>
    </ModuleLayout>
  )
}
