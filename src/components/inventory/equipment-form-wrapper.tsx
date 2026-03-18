'use client'

import { useRouter } from 'next/navigation'
import { EquipmentForm } from './equipment-form'

export function EquipmentFormWrapper() {
  const router = useRouter()

  return (
    <EquipmentForm
      onSuccess={() => {
        router.push('/inventory')
        router.refresh()
      }}
      onCancel={() => {
        router.back()
      }}
    />
  )
}
