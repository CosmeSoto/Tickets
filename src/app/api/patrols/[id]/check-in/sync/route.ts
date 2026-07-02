/**
 * POST /api/patrols/[id]/check-in/sync
 * Sincroniza un lote de check-ins offline en orden cronológico.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { PatrolQRService } from '@/lib/services/patrol-qr.service'
import { PatrolGeofenceService } from '@/lib/services/patrol-geofence.service'
import { PatrolPhotoService } from '@/lib/services/patrol-photo.service'
import { PatrolOfflineSyncService } from '@/lib/services/patrol-offline-sync.service'
import { calculateCompletionPercentage } from '@/lib/patrol/patrol-completion'
import { PATROL_FAMILY_DEFAULTS } from '@/lib/patrol/patrol-family-config'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { NotificationService } from '@/lib/services/notification-service'
import { NotificationType } from '@prisma/client'
import { getPatrolSupervisors } from '@/lib/patrol/patrol-helpers'

const offlineCheckInSchema = z.object({
  checkpointId: z.string().uuid(),
  qrToken: z.string().min(1),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  gpsAccuracyMeters: z.number().min(0).optional(),
  deviceTimestamp: z.string().datetime(),
  photoBase64: z.string().optional(),
  localQueueId: z.string().min(1),
})

const syncSchema = z.object({
  checkIns: z.array(offlineCheckInSchema).min(1).max(100),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id: patrolId } = await params
    const body = await request.json()
    const { checkIns } = syncSchema.parse(body)

    const patrol = await prisma.patrols.findUnique({
      where: { id: patrolId },
      select: {
        id: true,
        agentId: true,
        familyId: true,
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
        route: {
          select: {
            routeCheckpoints: {
              select: {
                order: true,
                isRequired: true,
                checkpointId: true,
                checkpoint: {
                  select: {
                    id: true,
                    latitude: true,
                    longitude: true,
                    geofenceRadiusMeters: true,
                    qrType: true,
                    qrSecret: true,
                    qrStaticToken: true,
                    isSensitive: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!patrol) return NextResponse.json({ error: 'Patrulla no encontrada' }, { status: 404 })
    if (patrol.agentId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const familyConfig = await prisma.patrol_family_config.findUnique({
      where: { familyId: patrol.familyId },
      select: {
        qrWindowMinutes: true,
        geofenceRadiusMeters: true,
        offlineSyncToleranceMinutes: true,
      },
    })
    const qrWindowMinutes = familyConfig?.qrWindowMinutes ?? PATROL_FAMILY_DEFAULTS.qrWindowMinutes
    const familyRadius =
      familyConfig?.geofenceRadiusMeters ?? PATROL_FAMILY_DEFAULTS.geofenceRadiusMeters
    const toleranceMinutes =
      familyConfig?.offlineSyncToleranceMinutes ??
      PATROL_FAMILY_DEFAULTS.offlineSyncToleranceMinutes

    // Ordenar cronológicamente y validar timestamps
    const batchResults = PatrolOfflineSyncService.processBatch(
      checkIns,
      patrol.scheduledStart,
      patrol.scheduledEnd,
      toleranceMinutes
    )

    const results: Array<{
      localQueueId: string
      status: 'ACCEPTED' | 'REJECTED'
      checkInId?: string
      error?: string
      message?: string
    }> = []

    const checkpointMap = new Map(
      patrol.route.routeCheckpoints.map(rc => [rc.checkpointId, rc.checkpoint])
    )

    // Supervisores para notificaciones de rechazo
    const supervisors = await getPatrolSupervisors(patrol.familyId)

    for (const batchItem of batchResults) {
      const item = checkIns.find(ci => ci.localQueueId === batchItem.localQueueId)!

      // Rechazar por timestamp fuera de ventana
      if (batchItem.timestampValidation === 'OFFLINE_SYNC_REJECTED') {
        await prisma.patrol_check_ins.create({
          data: {
            id: randomUUID(),
            patrolId,
            checkpointId: item.checkpointId,
            agentId: session.user.id,
            submittedTokenHash: PatrolQRService.hashTokenForStorage(item.qrToken),
            gpsLat: item.gpsLat,
            gpsLng: item.gpsLng,
            gpsAccuracyMeters: item.gpsAccuracyMeters,
            validationResult: 'OFFLINE_SYNC_REJECTED',
            method: 'OFFLINE_SYNC',
            deviceTimestamp: batchItem.deviceTimestamp,
            syncedAt: new Date(),
            isOffline: true,
          },
        })

        // Notificar supervisores
        await Promise.allSettled(
          supervisors.map(s =>
            NotificationService.push({
              userId: s.id,
              type: NotificationType.OFFLINE_SYNC_REJECTED,
              title: 'Check-in offline rechazado',
              message: `Un check-in offline fue rechazado por timestamp fuera de ventana (${batchItem.deviceTimestamp.toISOString()}).`,
              metadata: { patrolId, localQueueId: item.localQueueId },
            })
          )
        )

        results.push({
          localQueueId: item.localQueueId,
          status: 'REJECTED',
          error: 'OFFLINE_SYNC_REJECTED',
          message: 'Timestamp fuera de la ventana permitida',
        })
        continue
      }

      // Validar checkpoint en ruta
      const checkpoint = checkpointMap.get(item.checkpointId)
      if (!checkpoint) {
        results.push({
          localQueueId: item.localQueueId,
          status: 'REJECTED',
          error: 'CHECKPOINT_NOT_IN_ROUTE',
          message: 'El checkpoint no pertenece a esta ruta',
        })
        continue
      }

      // Validar token QR
      const tokenValid =
        checkpoint.qrType === 'STATIC'
          ? PatrolQRService.validateStaticToken(item.qrToken, checkpoint.qrStaticToken)
          : PatrolQRService.validateToken(
              item.qrToken,
              checkpoint.qrSecret,
              qrWindowMinutes,
              batchItem.deviceTimestamp.getTime()
            )

      if (!tokenValid) {
        await prisma.patrol_check_ins.create({
          data: {
            id: randomUUID(),
            patrolId,
            checkpointId: item.checkpointId,
            agentId: session.user.id,
            submittedTokenHash: PatrolQRService.hashTokenForStorage(item.qrToken),
            gpsLat: item.gpsLat,
            gpsLng: item.gpsLng,
            validationResult: 'QR_TOKEN_INVALID',
            method: 'OFFLINE_SYNC',
            deviceTimestamp: batchItem.deviceTimestamp,
            syncedAt: new Date(),
            isOffline: true,
          },
        })

        results.push({
          localQueueId: item.localQueueId,
          status: 'REJECTED',
          error: 'QR_TOKEN_INVALID',
          message: 'Token QR inválido',
        })
        continue
      }

      // Validar GPS si disponible
      let distanceMeters: number | null = null
      if (
        item.gpsLat !== undefined &&
        item.gpsLng !== undefined &&
        checkpoint.latitude !== null &&
        checkpoint.longitude !== null
      ) {
        const geoResult = PatrolGeofenceService.isWithinGeofence(
          { lat: checkpoint.latitude, lng: checkpoint.longitude },
          { lat: item.gpsLat, lng: item.gpsLng },
          checkpoint.geofenceRadiusMeters,
          familyRadius
        )
        distanceMeters = geoResult.distanceMeters
      }

      // Guardar foto si existe
      let photoId: string | null = null
      if (item.photoBase64) {
        const photo = await PatrolPhotoService.savePhoto(
          item.photoBase64,
          null,
          patrolId,
          batchItem.deviceTimestamp
        )
        photoId = photo.id
      }

      const checkIn = await prisma.patrol_check_ins.create({
        data: {
          id: randomUUID(),
          patrolId,
          checkpointId: item.checkpointId,
          agentId: session.user.id,
          submittedTokenHash: PatrolQRService.hashTokenForStorage(item.qrToken),
          gpsLat: item.gpsLat,
          gpsLng: item.gpsLng,
          gpsAccuracyMeters: item.gpsAccuracyMeters,
          distanceFromCheckpointMeters: distanceMeters,
          validationResult: 'VALID',
          method: 'OFFLINE_SYNC',
          deviceTimestamp: batchItem.deviceTimestamp,
          syncedAt: new Date(),
          isOffline: true,
        },
      })

      if (photoId) {
        await prisma.patrol_photos.update({
          where: { id: photoId },
          data: { checkInId: checkIn.id },
        })
      }

      results.push({ localQueueId: item.localQueueId, status: 'ACCEPTED', checkInId: checkIn.id })
    }

    // Calcular progreso final
    const allValidCheckIns = await prisma.patrol_check_ins.findMany({
      where: { patrolId, validationResult: 'VALID' },
      select: { checkpointId: true },
    })
    const visitedIds = new Set(allValidCheckIns.map(ci => ci.checkpointId))
    const requiredCheckpoints = patrol.route.routeCheckpoints.filter(rc => rc.isRequired)
    const visitedRequired = requiredCheckpoints.filter(rc => visitedIds.has(rc.checkpointId)).length
    const completionPercentage = calculateCompletionPercentage(
      visitedRequired,
      requiredCheckpoints.length
    )

    await prisma.patrols.update({ where: { id: patrolId }, data: { completionPercentage } })

    await AuditServiceComplete.log({
      action: 'PATROL_OFFLINE_SYNC',
      entityType: 'patrol',
      entityId: patrolId,
      userId: session.user.id,
      details: {
        total: checkIns.length,
        accepted: results.filter(r => r.status === 'ACCEPTED').length,
        rejected: results.filter(r => r.status === 'REJECTED').length,
      },
      request,
    })

    return NextResponse.json({
      success: true,
      results,
      completionPercentage,
      patrolStatus: patrol.status,
    })
  } catch (error) {
    console.error('[patrol/[id]/check-in/sync] POST:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
