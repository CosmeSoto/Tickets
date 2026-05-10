'use server'

import { revalidatePath } from 'next/cache'
import { EquipmentService } from '../services/equipment-inventory.service'
import { individualEquipmentSchema } from '../schemas/equipment-inventory.schema'
import { withAuth } from './action-wrapper'

function revalidateInventory() {
  revalidatePath('/inventory')
  revalidatePath('/inventory/models')
}

export async function createIndividualEquipment(formData: unknown) {
  const result = await withAuth(async userId => {
    const data = individualEquipmentSchema.parse(formData)
    const equipment = await EquipmentService.createIndividual({ ...data, userId })
    revalidateInventory()
    return { id: equipment.id, code: equipment.code }
  })
  return result
}

export async function updateEquipment(id: string, formData: unknown) {
  const result = await withAuth(async () => {
    const data = individualEquipmentSchema.partial().parse(formData)
    const equipment = await EquipmentService.update(id, data)
    revalidateInventory()
    revalidatePath(`/inventory/equipment/${id}`)
    return { id: equipment.id, code: equipment.code }
  })
  return result
}

export async function deleteEquipment(id: string) {
  const result = await withAuth(
    async () => {
      await EquipmentService.delete(id)
      revalidateInventory()
    },
    { successMessage: 'Equipo eliminado exitosamente' }
  )
  return result
}
