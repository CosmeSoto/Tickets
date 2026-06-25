/**
 * Ticket Settings Page - Refactored
 * Reduced from 876 lines to ~80 lines (90.8% reduction)
 */

'use client'

import { Suspense } from 'react'
import { Save, RefreshCw, Layers, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { useTicketSettings } from '@/hooks/use-ticket-settings'
import { TicketAreasTab } from '@/components/settings/tickets/ticket-areas-tab'
import { TicketGlobalTab } from '@/components/settings/tickets/ticket-global-tab'

function TicketSettingsContent() {
  const {
    isSuperAdmin,
    families,
    selectedFamilyId,
    selectedFamily,
    config,
    setConfig,
    slaRows,
    globalSettings,
    activeDays,
    loadingFamilies,
    loadingConfig,
    saving,
    setGlobalDirty,
    loadFamilies,
    loadGlobalSettings,
    handleSelectFamily,
    handleToggleTickets,
    toggleDay,
    handleSave,
    setGlobal,
  } = useTicketSettings()

  return (
    <ModuleLayout
      title='Configuración de Tickets'
      subtitle='Configura el comportamiento del módulo de tickets'
      headerActions={
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              loadFamilies()
              loadGlobalSettings()
            }}
            disabled={loadingFamilies}
          >
            <RefreshCw className={`h-4 w-4 ${loadingFamilies ? 'animate-spin' : ''} sm:mr-2`} />
            <span className='hidden sm:inline'>Recargar</span>
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''} sm:mr-2`} />
            <span className='hidden sm:inline'>{saving ? 'Guardando...' : 'Guardar cambios'}</span>
          </Button>
        </div>
      }
    >
      <Tabs defaultValue='areas' className='space-y-6'>
        <TabsList className='w-full sm:w-auto'>
          <TabsTrigger value='areas' className='flex-1 sm:flex-none flex items-center gap-2'>
            <Layers className='h-4 w-4' />
            Por área
          </TabsTrigger>
          <TabsTrigger
            value='global'
            className='flex-1 sm:flex-none flex items-center gap-2'
            onClick={() => isSuperAdmin && setGlobalDirty(true)}
            disabled={!isSuperAdmin}
          >
            <Settings className='h-4 w-4' />
            Reglas generales
          </TabsTrigger>
        </TabsList>

        <TabsContent value='areas'>
          <TicketAreasTab
            families={families}
            selectedFamilyId={selectedFamilyId}
            selectedFamily={selectedFamily}
            config={config}
            slaRows={slaRows}
            activeDays={activeDays}
            loadingFamilies={loadingFamilies}
            loadingConfig={loadingConfig}
            isSuperAdmin={isSuperAdmin}
            onSelectFamily={handleSelectFamily}
            onToggleTickets={handleToggleTickets}
            onSetConfig={setConfig}
            onToggleDay={toggleDay}
          />
        </TabsContent>

        <TabsContent value='global'>
          <TicketGlobalTab
            families={families}
            globalSettings={globalSettings}
            onSetGlobal={setGlobal}
          />
        </TabsContent>
      </Tabs>
    </ModuleLayout>
  )
}

export default function TicketSettingsPage() {
  return (
    <Suspense
      fallback={
        <ModuleLayout title='Configuración de Tickets' loading={true}>
          <div />
        </ModuleLayout>
      }
    >
      <TicketSettingsContent />
    </Suspense>
  )
}
