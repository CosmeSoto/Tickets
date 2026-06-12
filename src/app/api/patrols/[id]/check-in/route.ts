/**
 * POST /api/patrols/[id]/check-in
 * Valida y registra un check-in en tiempo real.
 * Registra TODOS los intentos (exitosos y fallidos) para auditoría.
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
import { calculateCompletionPercentage } from '@/lib/patrol/patrol-completion'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'

const checkInSchema = z.object({
  checkpointId: z.string().uuid(),
  qrToken: z.string().min(1),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  gpsAccuracyMeters: z.number().min(0).optional(),
  deviceTimestamp: z.string().datetime(),
  photoBase64: z.string().optional(),
  isOffline: z.literal(false).optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id: patrolId } = await params
    const body = await request.json()
    const data = checkInSchema.parse(body)

    // ── Cargar patrulla con contexto completo ──────────────────────────────
    const patrol = await prisma.patrols.findUnique({
      where: { id: patrolId },
      select: {
        id: true,
        agentId: true,
        familyId: true,
        scheduleId: true,
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
                    name: true,
                    latitude: true,
                    longitude: true,
                    geofenceRadiusMeters: true,
                    qrType: true,
                    qrSecret: true, // Solo validación — NUNCA en respuesta
                    qrStaticToken: true,
                    isSensitive: true,
                    hasConnectivity: true,
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    })

    if (!patrol) return NextResponse.json({ error: 'Patrulla no encontrada' }, { status: 404 })

    // Validar que el agente es el asignado
    if (patrol.agentId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado para esta patrulla' }, { status: 403 })
    }

    // Validar estado de la patrulla
    if (patrol.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'La patrulla no está en progreso', code: 'PATROL_NOT_ACTIVE' },
        { status: 409 }
      )
    }

    // Validar que el checkpoint pertenece a la ruta
    const routeCheckpoint = patrol.route.routeCheckpoints.find(
      rc => rc.checkpointId === data.checkpointId
    )
    if (!routeCheckpoint) {
      return NextResponse.json(
        { error: 'El checkpoint no pertenece a esta ruta', code: 'CHECKPOINT_NOT_IN_ROUTE' },
        { status: 422 }
      )
    }

    const checkpoint = routeCheckpoint.checkpoint

    // Obtener config de familia y override de la programación en paralelo
    const [familyConfig, scheduleConfig] = await Promise.all([
      prisma.patrol_family_config.findUnique({
        where: { familyId: patrol.familyId },
        select: {
          qrWindowMinutes: true,
          geofenceRadiusMeters: true,
          alertCompletionThreshold: true,
          gracePeriodMinutes: true,
          strictTimeValidation: true,
        },
      }),
      patrol.scheduleId
        ? prisma.patrol_schedules.findUnique({
            where: { id: patrol.scheduleId },
            select: { overrideTimeValidation: true },
          })
        : Promise.resolve(null),
    ])
    const qrWindowMinutes = familyConfig?.qrWindowMinutes ?? 5
    const familyRadius = familyConfig?.geofenceRadiusMeters ?? 50

    // ── Validar ventana de tiempo para escanear ────────────────────────────
    // Jerarquía igual que al iniciar la patrulla:
    //   1. overrideTimeValidation del schedule (si no es null) → prioridad
    //   2. strictTimeValidation de la familia → default
    const strictTimeValidation =
      scheduleConfig?.overrideTimeValidation !== null &&
      scheduleConfig?.overrideTimeValidation !== undefined
        ? scheduleConfig.overrideTimeValidation
        : (familyConfig?.strictTimeValidation ?? true)

    if (strictTimeValidation) {
      const now = new Date()
      const gracePeriodMinutes = familyConfig?.gracePeriodMinutes ?? 15
      const latestScan = new Date(patrol.scheduledEnd.getTime() + gracePeriodMinutes * 60 * 1000)

      if (now > latestScan) {
        const minutesPast = Math.floor((now.getTime() - patrol.scheduledEnd.getTime()) / 60000)
        const h = Math.floor(minutesPast / 60)
        const m = minutesPast % 60
        const timeLabel = h > 0 && m > 0 ? `${h}h ${m}min` : h > 0 ? `${h}h` : `${m} minutos`
        return NextResponse.json(
          {
            error: `El tiempo de escaneo para esta ronda ya expiró hace ${timeLabel}. No se pueden registrar más check-ins.`,
            code: 'SCAN_WINDOW_EXPIRED',
          },
          { status: 422 }
        )
      }
    }

    // ── Validar si el checkpoint ya fue visitado (re-escaneo) ─────────────
    const existingValidCheckIn = await prisma.patrol_check_ins.findFirst({
      where: {
        patrolId,
        checkpointId: data.checkpointId,
        validationResult: 'VALID',
      },
      select: { id: true, serverTimestamp: true },
    })

    if (existingValidCheckIn) {
      return NextResponse.json(
        {
          error: 'Este checkpoint ya fue registrado en esta ronda. No se permiten re-escaneos.',
          code: 'CHECKPOINT_ALREADY_VISITED',
        },
        { status: 409 }
      )
    }

    // ── Validar orden secuencial con tolerancia de skip ───────────────────
    // Regla de negocio:
    //   - Saltar 1 checkpoint requerido consecutivo → PERMITIDO con advertencia
    //     (el agente tuvo un contratiempo y puede continuar la ronda)
    //   - Saltar 2 o más checkpoints requeridos seguidos → INVALIDAR la ronda
    //     (marca como INCOMPLETE y bloquea más check-ins)
    //
    // Un checkpoint "saltado" es uno requerido que aparece ANTES del actual
    // en el orden de la ruta y que AÚN NO ha sido visitado.
    const visitedCheckIns = await prisma.patrol_check_ins.findMany({
      where: { patrolId, validationResult: 'VALID' },
      select: { checkpointId: true },
    })
    const visitedSet = new Set(visitedCheckIns.map(ci => ci.checkpointId))

    // Ordenar todos los checkpoints de la ruta por su orden
    const sortedRoute = [...patrol.route.routeCheckpoints].sort((a, b) => a.order - b.order)

    // Índice del checkpoint que se intenta escanear
    const attemptedIdx = sortedRoute.findIndex(rc => rc.checkpointId === data.checkpointId)

    // Checkpoints requeridos que están ANTES del actual y NO han sido visitados = saltados
    const skippedRequired = sortedRoute
      .slice(0, attemptedIdx)
      .filter(rc => rc.isRequired && !visitedSet.has(rc.checkpointId))

    const MAX_ALLOWED_SKIPS = 1 // un contratiempo puntual es tolerable

    if (skippedRequired.length > MAX_ALLOWED_SKIPS) {
      // ── Demasiados checkpoints saltados → invalidar ronda ────────────────
      const requiredCheckpointIds = sortedRoute
        .filter(rc => rc.isRequired)
        .map(rc => rc.checkpointId)
      const missedIds = requiredCheckpointIds.filter(cid => !visitedSet.has(cid))
      const visitedRequired = requiredCheckpointIds.filter(cid => visitedSet.has(cid)).length
      const completionPct = calculateCompletionPercentage(
        visitedRequired,
        requiredCheckpointIds.length
      )

      // Cerrar la ronda como INCOMPLETE
      await prisma.patrols.update({
        where: { id: patrolId },
        data: {
          status: 'INCOMPLETE',
          completedAt: new Date(),
          completionPercentage: completionPct,
          missedCheckpointIds: missedIds,
        },
      })

      // Notificar supervisores
      try {
        const { getPatrolSupervisors } = await import('@/lib/patrol/patrol-helpers')
        const { NotificationService } = await import('@/lib/services/notification-service')
        const { NotificationType } = await import('@prisma/client')
        const supervisors = await getPatrolSupervisors(patrol.familyId)
        const agentName = session.user.name ?? session.user.email ?? 'Agente'
        await Promise.allSettled(
          supervisors.map(s =>
            NotificationService.push({
              userId: s.id,
              type: NotificationType.PATROL_INCOMPLETE,
              title: 'Ronda invalidada por checkpoints saltados',
              message: `La ronda del agente ${agentName} fue invalidada automáticamente: intentó saltar ${skippedRequired.length} checkpoints requeridos consecutivos (más del máximo permitido de ${MAX_ALLOWED_SKIPS}). Completitud: ${completionPct}%.`,
              metadata: {
                patrolId,
                agentId: patrol.agentId,
                familyId: patrol.familyId,
                skippedCount: skippedRequired.length,
                completionPct,
                autoInvalidated: true,
              },
            })
          )
        )
      } catch {
        // Notificación opcional — no bloquear la respuesta
      }

      await AuditServiceComplete.log({
        action: 'PATROL_AUTO_INVALIDATED',
        entityType: 'patrol',
        entityId: patrolId,
        userId: session.user.id,
        details: {
          skippedCount: skippedRequired.length,
          skippedCheckpointIds: skippedRequired.map(rc => rc.checkpointId),
          completionPct,
        },
        request,
      })

      const skippedNames = skippedRequired
        .map(rc => `#${rc.order} ${rc.checkpoint.name}`)
        .join(', ')
      return NextResponse.json(
        {
          error: `Ronda invalidada: tienes ${skippedRequired.length} checkpoints requeridos sin escanear (${skippedNames}). Se permite saltar máximo ${MAX_ALLOWED_SKIPS}. La ronda fue cerrada como incompleta. Debes reportar la novedad al supervisor.`,
          code: 'PATROL_INVALIDATED_TOO_MANY_SKIPS',
          skippedCount: skippedRequired.length,
          skippedCheckpoints: skippedRequired.map(rc => ({
            id: rc.checkpointId,
            name: rc.checkpoint.name,
            order: rc.order,
          })),
          completionPercentage: completionPct,
          patrolStatus: 'INCOMPLETE',
        },
        { status: 422 }
      )
    }

    // Si hay exactamente 1 skip permitido, registramos la advertencia en los metadatos
    // pero dejamos continuar (se informa al agente en la respuesta exitosa al final)

    // ── Validar foto requerida ─────────────────────────────────────────────
    // Solo se exige foto cuando el checkpoint está marcado como sensible.
    // La presencia de GPS no implica obligatoriedad de foto.
    const photoRequired = checkpoint.isSensitive

    if (photoRequired && !data.photoBase64) {
      return NextResponse.json(
        { error: 'Se requiere foto para este checkpoint', code: 'PHOTO_REQUIRED' },
        { status: 422 }
      )
    }

    // ── Validar token QR ───────────────────────────────────────────────────
    let validationResult: 'VALID' | 'QR_TOKEN_INVALID' | 'GPS_OUT_OF_GEOFENCE' = 'VALID'
    let distanceMeters: number | null = null

    const tokenValid =
      checkpoint.qrType === 'STATIC'
        ? PatrolQRService.validateStaticToken(data.qrToken, checkpoint.qrStaticToken)
        : PatrolQRService.validateToken(data.qrToken, checkpoint.qrSecret, qrWindowMinutes)

    if (!tokenValid) {
      validationResult = 'QR_TOKEN_INVALID'
    }

    // ── Validar GPS (solo si token válido y hay coordenadas) ───────────────
    if (
      validationResult === 'VALID' &&
      data.gpsLat !== undefined &&
      data.gpsLng !== undefined &&
      checkpoint.latitude !== null &&
      checkpoint.longitude !== null
    ) {
      const geoResult = PatrolGeofenceService.isWithinGeofence(
        { lat: checkpoint.latitude, lng: checkpoint.longitude },
        { lat: data.gpsLat, lng: data.gpsLng },
        checkpoint.geofenceRadiusMeters,
        familyRadius
      )
      distanceMeters = geoResult.distanceMeters

      if (!geoResult.isValid) {
        validationResult = 'GPS_OUT_OF_GEOFENCE'
      }
    }

    // ── Guardar foto si se proporcionó ─────────────────────────────────────
    let photoId: string | null = null
    if (data.photoBase64 && validationResult === 'VALID') {
      const photo = await PatrolPhotoService.savePhoto(
        data.photoBase64,
        null, // se actualiza después de crear el check-in
        patrolId,
        new Date(data.deviceTimestamp)
      )
      photoId = photo.id
    }

    // ── Registrar intento (exitoso o fallido) ──────────────────────────────
    const checkIn = await prisma.patrol_check_ins.create({
      data: {
        id: randomUUID(),
        patrolId,
        checkpointId: data.checkpointId,
        agentId: session.user.id,
        submittedTokenHash: PatrolQRService.hashTokenForStorage(data.qrToken),
        gpsLat: data.gpsLat,
        gpsLng: data.gpsLng,
        gpsAccuracyMeters: data.gpsAccuracyMeters,
        distanceFromCheckpointMeters: distanceMeters,
        validationResult,
        method: checkpoint.qrType === 'STATIC' ? 'QR_STATIC' : 'QR_DYNAMIC',
        deviceTimestamp: new Date(data.deviceTimestamp),
        isOffline: false,
      },
    })

    // Vincular foto al check-in si existe
    if (photoId) {
      await prisma.patrol_photos.update({
        where: { id: photoId },
        data: { checkInId: checkIn.id },
      })
    }

    // ── Responder con error si validación falló ────────────────────────────
    if (validationResult !== 'VALID') {
      await AuditServiceComplete.log({
        action: 'PATROL_CHECKIN_FAILED',
        entityType: 'patrol',
        entityId: patrolId,
        userId: session.user.id,
        details: { checkpointId: data.checkpointId, validationResult, distanceMeters },
        request,
      })

      return NextResponse.json(
        {
          error:
            validationResult === 'QR_TOKEN_INVALID'
              ? 'Token QR inválido'
              : 'Fuera del área del checkpoint',
          code: validationResult,
          ...(distanceMeters !== null ? { distanceMeters } : {}),
        },
        { status: 422 }
      )
    }

    // ── Calcular progreso actualizado ──────────────────────────────────────
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

    // Actualizar completionPercentage en la patrulla
    await prisma.patrols.update({
      where: { id: patrolId },
      data: { completionPercentage },
    })

    // Siguiente checkpoint no visitado
    const nextCheckpoint = patrol.route.routeCheckpoints.find(
      rc => !visitedIds.has(rc.checkpointId)
    )

    await AuditServiceComplete.log({
      action: 'PATROL_CHECKIN_SUCCESS',
      entityType: 'patrol',
      entityId: patrolId,
      userId: session.user.id,
      details: { checkpointId: data.checkpointId, completionPercentage },
      request,
    })

    return NextResponse.json({
      success: true,
      checkInId: checkIn.id,
      validationResult: 'VALID',
      completionPercentage,
      patrolStatus: patrol.status,
      nextCheckpoint: nextCheckpoint
        ? {
            id: nextCheckpoint.checkpoint.id,
            name: nextCheckpoint.checkpoint.name,
            order: nextCheckpoint.order,
          }
        : null,
      // Advertencia cuando el agente saltó 1 checkpoint requerido (tolerancia)
      ...(skippedRequired.length === 1 && {
        warning: {
          code: 'CHECKPOINT_SKIPPED',
          message: `Saltaste el checkpoint #${skippedRequired[0].order} (${skippedRequired[0].checkpoint.name}). Queda registrado como no visitado. Debes reportar una novedad antes de finalizar la ronda.`,
          skippedCheckpoints: skippedRequired.map(rc => ({
            id: rc.checkpointId,
            name: rc.checkpoint.name,
            order: rc.order,
          })),
          requiresIncidentReport: true,
        },
      }),
    })
  } catch (error) {
    console.error('[patrol/[id]/check-in] POST:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
