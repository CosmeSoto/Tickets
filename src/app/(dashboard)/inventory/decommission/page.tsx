'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { DecommissionRequestList } from '@/components/inventory/decommission/DecommissionRequestList'
import { DecommissionApprovalPanel } from '@/components/inventory/decommission/DecommissionApprovalPanel'

export default function DecommissionPage() {
  const { data: session } = useSession()
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const isAdmin = session?.user?.role === 'ADMIN'

  const handleActionComplete = () => {
    setSelectedRequest(null)
    setRefreshTrigger(t => t + 1)
  }

  return (
    <RoleDashboardLayout
      title="Actas de Baja"
      subtitle={isAdmin ? 'Gestiona y aprueba solicitudes de baja de activos' : 'Tus solicitudes de baja de activos'}
    >
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
              isAdmin={isAdmin}
              onActionComplete={handleActionComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </RoleDashboardLayout>
  )
}
