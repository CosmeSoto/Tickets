'use client'

import { Suspense } from 'react'
import { Save, RefreshCw, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { usePatrolSettings } from '@/hooks/use-patrol-settings'
import { PatrolAreasTab } from '@/components/settings/patrol/patrol-areas-tab'

function PatrolSettingsContent() {
  const {
    families,
    selectedFamilyId,
    selectedFamily,
    form,
    loadingFamilies,
    loadingConfig,
    saving,
    loadFamilies,
    handleSelectFamily,
    handleTogglePatrols,
    handleSave,
    setField,
  } = usePatrolSettings()

  return (
    <ModuleLayout
      title='Configuración de Rondas'
      subtitle='Configura los parámetros del módulo de patrullaje por área'
      headerActions={
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={loadFamilies} disabled={loadingFamilies}>
            <RefreshCw className={`h-4 w-4 ${loadingFamilies ? 'animate-spin' : ''} sm:mr-2`} />
            <span className='hidden sm:inline'>Recargar</span>
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedFamilyId}>
            <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''} sm:mr-2`} />
            <span className='hidden sm:inline'>{saving ? 'Guardando...' : 'Guardar cambios'}</span>
          </Button>
        </div>
      }
    >
      <PatrolAreasTab
        families={families}
        selectedFamilyId={selectedFamilyId}
        selectedFamily={selectedFamily}
        form={form}
        loadingFamilies={loadingFamilies}
        loadingConfig={loadingConfig}
        saving={saving}
        onSelectFamily={handleSelectFamily}
        onTogglePatrols={handleTogglePatrols}
        onSetField={setField}
      />
    </ModuleLayout>
  )
}

export default function PatrolSettingsPage() {
  return (
    <Suspense
      fallback={
        <ModuleLayout title='Configuración de Rondas' loading={true}>
          <div />
        </ModuleLayout>
      }
    >
      <PatrolSettingsContent />
    </Suspense>
  )
}
