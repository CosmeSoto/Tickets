'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DecommissionRequestList } from '@/components/inventory/decommission/DecommissionRequestList'
import { DecommissionApprovalPanel } from '@/components/inventory/decommission/DecommissionApprovalPanel'

export default function DecommissionPage() {
  const { data: session } = useSession()
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const role = session?.user?.role ?? ''
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canManageInventory = (session?.user as any)?.canManageInventory === true
  const isAdmin = role === 'ADMIN'
  const isTechnician = role === 'TECHNICIAN'

  const userContext = {
    id: session?.user?.id ?? '',
    role,
    isSuperAdmin,
    canManageInventory,
  }

  const subtitle = isSuperAdmin
    ? 'Vista global — todas las familias'
    : isAdmin
      ? 'Aprueba solicitudes de baja de activos'
      : isTechnician
        ? 'Emite dictámenes técnicos de baja'
        : canManageInventory
          ? 'Gestiona y eleva solicitudes de baja de tus familias'
          : 'Tus solicitudes de baja de activos'

  const handleActionComplete = () => {
    setSelectedRequest(null)
    setRefreshTrigger(t => t + 1)
  }

  return (
    <ModuleLayout title="Actas de Baja" subtitle={subtitle}>
      <DecommissionRequestList
        onViewDetail={setSelectedRequest}
        refreshTrigger={refreshTrigger}
      />

      <Dialog open={!!selectedRequest} onOpenChange={o => !o && setSelectedRequest(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Detalle de Solicitud</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <DecommissionApprovalPanel
              request={selectedRequest}
              userContext={userContext}
              onActionComplete={handleActionComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  )
}
