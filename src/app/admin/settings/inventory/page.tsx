/**
 * Inventory Settings Page - Refactored
 * Reduced from 1,089 lines to ~80 lines (92.7% reduction)
 */

'use client'

import { Suspense } from 'react'
import { Save, RefreshCw, Layers, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { useInventorySettings } from '@/hooks/use-inventory-settings'
import { InventoryAreasTab } from '@/components/settings/inventory/inventory-areas-tab'
import { InventoryGlobalTab } from '@/components/settings/inventory/inventory-global-tab'
import { InventoryCustomFieldsTab } from '@/components/settings/inventory/inventory-custom-fields-tab'

function InventorySettingsContent() {
  const {
    families,
    selectedFamilyId,
    selectedFamily,
    form,
    globalRules,
    loadingFamilies,
    loadingConfig,
    saving,
    savingGlobal,
    residualError,
    activeModeTab,
    setActiveModeTab,
    useModeConfig,
    setUseModeConfig,
    loadFamilies,
    handleSelectFamily,
    handleToggleInventory,
    handleSave,
    handleSaveGlobal,
    setField,
    setGlobal,
    toggleSubtype,
    toggleVisible,
    toggleRequired,
    getModeConfig,
    setModeVisible,
    setModeRequired,
    validateResidual,
  } = useInventorySettings()

  return (
    <ModuleLayout
      title='Configuración de Inventario'
      subtitle='Configura el comportamiento del módulo de inventario por área'
      headerActions={
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={loadFamilies} disabled={loadingFamilies}>
            <RefreshCw className={`h-4 w-4 ${loadingFamilies ? 'animate-spin' : ''} sm:mr-2`} />
            <span className='hidden sm:inline'>Recargar</span>
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedFamilyId || !!residualError}>
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
          <TabsTrigger value='global' className='flex-1 sm:flex-none flex items-center gap-2'>
            <Settings className='h-4 w-4' />
            Reglas generales
          </TabsTrigger>
          <TabsTrigger
            value='custom-fields'
            className='flex-1 sm:flex-none flex items-center gap-2'
          >
            <Settings className='h-4 w-4' />
            Campos Personalizados
          </TabsTrigger>
        </TabsList>

        <TabsContent value='areas'>
          <InventoryAreasTab
            families={families}
            selectedFamilyId={selectedFamilyId}
            selectedFamily={selectedFamily}
            form={form}
            loadingFamilies={loadingFamilies}
            loadingConfig={loadingConfig}
            saving={saving}
            residualError={residualError}
            activeModeTab={activeModeTab}
            useModeConfig={useModeConfig}
            onSelectFamily={handleSelectFamily}
            onToggleInventory={handleToggleInventory}
            onSetActiveModeTab={setActiveModeTab}
            onSetUseModeConfig={setUseModeConfig}
            onSetField={setField}
            onToggleSubtype={toggleSubtype}
            onToggleVisible={toggleVisible}
            onToggleRequired={toggleRequired}
            onGetModeConfig={getModeConfig}
            onSetModeVisible={setModeVisible}
            onSetModeRequired={setModeRequired}
            onValidateResidual={validateResidual}
          />
        </TabsContent>

        <TabsContent value='global'>
          <InventoryGlobalTab
            globalRules={globalRules}
            savingGlobal={savingGlobal}
            onSetGlobal={setGlobal}
            onSave={handleSaveGlobal}
          />
        </TabsContent>

        <TabsContent value='custom-fields'>
          <InventoryCustomFieldsTab families={families} />
        </TabsContent>
      </Tabs>
    </ModuleLayout>
  )
}

export default function InventorySettingsPage() {
  return (
    <Suspense
      fallback={
        <ModuleLayout title='Configuración de Inventario' loading={true}>
          <div />
        </ModuleLayout>
      }
    >
      <InventorySettingsContent />
    </Suspense>
  )
}
