/**
 * Acceso a la configuración de familia del módulo de patrullas.
 * Crea el registro con valores por defecto si no existe (para familias legacy).
 */

import prisma from '@/lib/prisma'
import type { patrol_family_config } from '@prisma/client'

/**
 * Obtiene la configuración de patrullas para una familia.
 * Si no existe (familia legacy), la crea con valores por defecto.
 *
 * @param familyId - ID de la familia
 * @returns Configuración de patrullas de la familia
 */
export async function getOrCreatePatrolFamilyConfig(
  familyId: string
): Promise<patrol_family_config> {
  return prisma.patrol_family_config.upsert({
    where: { familyId },
    update: {},
    create: {
      familyId,
      patrolsEnabled: true,
      qrWindowMinutes: 5,
      geofenceRadiusMeters: 1,
      photoRetentionDays: 90,
      photoCompressionQuality: 0.82,
      photoMaxWidthPx: 1280,
      requirePhotoOnStart: false,
      requirePhotoOnEnd: false,
      offlineSyncToleranceMinutes: 30,
      alertCompletionThreshold: 80,
      gracePeriodMinutes: 15,
      strictTimeValidation: true,
      patrolIncidentCategoryId: null,
    },
  })
}
