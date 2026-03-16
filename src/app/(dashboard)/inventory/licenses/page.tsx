'use client'

import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { BackToInventory } from '@/components/inventory/back-to-inventory'

export default function LicensesPage() {
  return (
    <RoleDashboardLayout
      title="Licencias de Software"
      subtitle="Gestión de licencias y asignaciones"
    >
      <BackToInventory />
      <div className="space-y-6">
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">Licencias de Software</h2>
          <p className="text-muted-foreground">
            Página en construcción. Funcionalidad backend completada.
          </p>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
