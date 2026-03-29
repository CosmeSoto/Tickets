import { ConsumableStatus } from '@prisma/client'

export function calculateConsumableStatus(
  currentStock: number,
  minStock: number,
  expirationDate?: Date | null
): ConsumableStatus {
  if (expirationDate && expirationDate < new Date()) return ConsumableStatus.EXPIRED
  if (currentStock === 0) return ConsumableStatus.OUT_OF_STOCK
  if (currentStock <= minStock) return ConsumableStatus.LOW_STOCK
  return ConsumableStatus.ACTIVE
}
