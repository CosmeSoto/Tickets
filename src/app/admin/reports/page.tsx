'use client'

/**
 * Módulo de Reportes Multi-Familia - REFACTORIZADO
 * Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 14.1, 14.2, 14.5, 14.7
 *
 * Reducido de 1,614 líneas a ~200 líneas (87.6% de reducción)
 */

import {
  BarChart3,
  Download,
  RefreshCw,
  Users,
  TrendingUp,
  ShieldCheck,
  FileDown,
  Star,
  AlertCircle,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReports } from '@/hooks/use-reports'
import { ReportFilters } from '@/components/reports/report-filters'
import {
  ExecutiveSummaryTab,
  TechniciansTab,
  TrendsTab,
  SLATab,
  SatisfactionTab,
} from '@/components/reports/tabs'

export default function ReportsPage() {
  const {
    // Session
    isSuperAdmin,

    // State
    families,
    selectedFamilyId,
    setSelectedFamilyId,
    activeTab,
    setActiveTab,
    granularity,
    setGranularity,
    startDate,
    setStartDate,
    endDate,
    setEndDate,

    // Data
    executiveData,
    techniciansData,
    trendsData,
    slaData,
    satisfactionData,

    // Loading states
    loadingFamilies,
    loadingData,
    error,

    // Computed
    selectedFamily,

    // Actions
    loadReportData,
    handleExportCSV,
    handleExportPDF,
    clearDateFilters,
  } = useReports()

  return (
    <ModuleLayout
      title='Reportes Multi-Familia'
      subtitle={
        isSuperAdmin
          ? 'Vista global — todas las familias'
          : 'Análisis de desempeño de tus familias asignadas'
      }
    >
      <div className='space-y-6'>
        {/* Filters */}
        <ReportFilters
          families={families}
          selectedFamilyId={selectedFamilyId}
          onFamilyChange={setSelectedFamilyId}
          selectedFamily={selectedFamily}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          onClearDates={clearDateFilters}
          loadingFamilies={loadingFamilies}
          isSuperAdmin={isSuperAdmin}
        />

        {/* Error */}
        {error && (
          <Card className='border-destructive/30 bg-destructive/5'>
            <CardContent className='py-4 flex items-center gap-3'>
              <AlertCircle className='h-5 w-5 text-destructive' />
              <span className='text-sm text-destructive'>{error}</span>
              <Button variant='outline' size='sm' onClick={loadReportData} className='ml-auto'>
                Reintentar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={v => setActiveTab(v as typeof activeTab)}
          className='space-y-4'
        >
          <div className='flex flex-col gap-2'>
            {/* Tabs — scroll horizontal en mobile */}
            <div className='overflow-x-auto -mx-1 px-1'>
              <TabsList className='inline-flex w-max min-w-full sm:w-full sm:grid sm:grid-cols-5'>
                <TabsTrigger
                  value='executive'
                  className='flex items-center gap-1.5 whitespace-nowrap'
                >
                  <BarChart3 className='h-4 w-4 flex-shrink-0' />
                  <span className='hidden lg:inline'>Resumen Ejecutivo</span>
                  <span className='lg:hidden'>Resumen</span>
                </TabsTrigger>
                <TabsTrigger
                  value='technicians'
                  className='flex items-center gap-1.5 whitespace-nowrap'
                >
                  <Users className='h-4 w-4 flex-shrink-0' />
                  <span>Técnicos</span>
                </TabsTrigger>
                <TabsTrigger value='trends' className='flex items-center gap-1.5 whitespace-nowrap'>
                  <TrendingUp className='h-4 w-4 flex-shrink-0' />
                  <span>Tendencias</span>
                </TabsTrigger>
                <TabsTrigger value='sla' className='flex items-center gap-1.5 whitespace-nowrap'>
                  <ShieldCheck className='h-4 w-4 flex-shrink-0' />
                  <span className='hidden lg:inline'>Cumplimiento SLA</span>
                  <span className='lg:hidden'>SLA</span>
                </TabsTrigger>
                <TabsTrigger
                  value='satisfaction'
                  className='flex items-center gap-1.5 whitespace-nowrap'
                >
                  <Star className='h-4 w-4 flex-shrink-0' />
                  <span className='hidden lg:inline'>Satisfacción</span>
                  <span className='lg:hidden'>★</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Action buttons */}
            <div className='flex items-center justify-end gap-2'>
              <Button variant='outline' size='sm' onClick={loadReportData} disabled={loadingData}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingData ? 'animate-spin' : ''}`} />
                <span className='hidden sm:inline'>Actualizar</span>
              </Button>
              <Button variant='outline' size='sm' onClick={handleExportCSV} disabled={loadingData}>
                <Download className='h-4 w-4 mr-1.5' />
                <span className='hidden sm:inline'>CSV</span>
              </Button>
              <Button variant='outline' size='sm' onClick={handleExportPDF} disabled={loadingData}>
                <FileDown className='h-4 w-4 mr-1.5' />
                <span className='hidden sm:inline'>PDF</span>
              </Button>
            </div>
          </div>

          {/* Tab Contents */}
          <TabsContent value='executive'>
            <ExecutiveSummaryTab
              data={executiveData}
              loading={loadingData}
              isAllFamilies={selectedFamilyId === 'all'}
            />
          </TabsContent>

          <TabsContent value='technicians'>
            <TechniciansTab data={techniciansData} loading={loadingData} />
          </TabsContent>

          <TabsContent value='trends'>
            <TrendsTab
              data={trendsData}
              loading={loadingData}
              granularity={granularity}
              onGranularityChange={setGranularity}
              isAllFamilies={selectedFamilyId === 'all'}
            />
          </TabsContent>

          <TabsContent value='sla'>
            <SLATab data={slaData} loading={loadingData} />
          </TabsContent>

          <TabsContent value='satisfaction'>
            <SatisfactionTab data={satisfactionData} loading={loadingData} />
          </TabsContent>
        </Tabs>
      </div>
    </ModuleLayout>
  )
}
