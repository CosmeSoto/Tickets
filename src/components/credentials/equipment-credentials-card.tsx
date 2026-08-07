'use client'

import { LinkedCredentialsCard } from '@/components/credentials/linked-credentials-card'

interface EquipmentCredentialsCardProps {
  equipmentId: string
  canManage?: boolean
}

/** @deprecated Prefer LinkedCredentialsCard with entity="equipment" */
export function EquipmentCredentialsCard({
  equipmentId,
  canManage = false,
}: EquipmentCredentialsCardProps) {
  return <LinkedCredentialsCard entity='equipment' entityId={equipmentId} canManage={canManage} />
}
