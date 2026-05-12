/**
 * Servicio de validación y procesamiento de check-ins offline.
 * Garantiza coherencia temporal entre el timestamp del dispositivo y la ventana de la patrulla.
 *
 * Función pura sin dependencias externas — apta para property-based testing.
 */

export type OfflineSyncValidationResult = 'VALID' | 'OFFLINE_SYNC_REJECTED'

export interface OfflineCheckInItem {
  checkpointId: string
  qrToken: string
  gpsLat?: number
  gpsLng?: number
  gpsAccuracyMeters?: number
  deviceTimestamp: string // ISO 8601
  photoBase64?: string
  localQueueId: string
}

export interface BatchProcessResult {
  localQueueId: string
  timestampValidation: OfflineSyncValidationResult
  deviceTimestamp: Date
}

export class PatrolOfflineSyncService {
  /**
   * Valida que el timestamp del dispositivo caiga dentro de la ventana permitida.
   *
   * Ventana válida: [scheduledStart - toleranceMinutes, scheduledEnd + toleranceMinutes]
   *
   * @param deviceTimestamp    - Timestamp del dispositivo (ISO 8601 o Date)
   * @param scheduledStart     - Inicio programado de la patrulla
   * @param scheduledEnd       - Fin programado de la patrulla
   * @param toleranceMinutes   - Tolerancia en minutos (>= 0)
   * @returns 'VALID' o 'OFFLINE_SYNC_REJECTED'
   */
  static validateTimestamp(
    deviceTimestamp: Date | string,
    scheduledStart: Date,
    scheduledEnd: Date,
    toleranceMinutes: number
  ): OfflineSyncValidationResult {
    const ts = typeof deviceTimestamp === 'string' ? new Date(deviceTimestamp) : deviceTimestamp
    const toleranceMs = toleranceMinutes * 60 * 1000

    const windowStart = new Date(scheduledStart.getTime() - toleranceMs)
    const windowEnd = new Date(scheduledEnd.getTime() + toleranceMs)

    if (ts >= windowStart && ts <= windowEnd) {
      return 'VALID'
    }

    return 'OFFLINE_SYNC_REJECTED'
  }

  /**
   * Ordena un lote de check-ins offline por deviceTimestamp (cronológico ascendente)
   * y retorna los resultados de validación de timestamp para cada ítem.
   *
   * El procesamiento real de cada check-in (validación QR, GPS, etc.) se realiza
   * en la API route, que consume este resultado para determinar el orden y filtrar
   * los rechazados por timestamp antes de continuar.
   *
   * @param items            - Lote de check-ins offline
   * @param scheduledStart   - Inicio programado de la patrulla
   * @param scheduledEnd     - Fin programado de la patrulla
   * @param toleranceMinutes - Tolerancia en minutos
   * @returns Items ordenados cronológicamente con resultado de validación de timestamp
   */
  static processBatch(
    items: OfflineCheckInItem[],
    scheduledStart: Date,
    scheduledEnd: Date,
    toleranceMinutes: number
  ): BatchProcessResult[] {
    // Ordenar cronológicamente por deviceTimestamp
    const sorted = [...items].sort((a, b) => {
      return new Date(a.deviceTimestamp).getTime() - new Date(b.deviceTimestamp).getTime()
    })

    return sorted.map(item => {
      const deviceTimestamp = new Date(item.deviceTimestamp)
      const timestampValidation = this.validateTimestamp(
        deviceTimestamp,
        scheduledStart,
        scheduledEnd,
        toleranceMinutes
      )

      return {
        localQueueId: item.localQueueId,
        timestampValidation,
        deviceTimestamp,
      }
    })
  }
}
