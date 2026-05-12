/**
 * Servicio de validación de geofence para checkpoints de patrulla.
 * Usa la fórmula de Haversine para calcular distancias sobre la superficie terrestre.
 *
 * Función pura sin dependencias externas — apta para property-based testing.
 */

const EARTH_RADIUS_METERS = 6_371_000

export interface Coordinates {
  lat: number
  lng: number
}

export interface GeofenceCheckResult {
  isValid: boolean
  distanceMeters: number
  effectiveRadiusMeters: number
}

export class PatrolGeofenceService {
  /**
   * Calcula la distancia en metros entre dos coordenadas usando la fórmula de Haversine.
   * Propiedad de simetría: haversineDistance(a, b) === haversineDistance(b, a)
   * Propiedad de identidad: haversineDistance(p, p) === 0
   *
   * @param p1 - Primera coordenada
   * @param p2 - Segunda coordenada
   * @returns Distancia en metros
   */
  static haversineDistance(p1: Coordinates, p2: Coordinates): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180

    const dLat = toRad(p2.lat - p1.lat)
    const dLng = toRad(p2.lng - p1.lng)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return EARTH_RADIUS_METERS * c
  }

  /**
   * Determina el radio efectivo del geofence para un checkpoint.
   * Usa el override del checkpoint si está definido, de lo contrario el default de familia.
   *
   * @param checkpointRadiusMeters - Radio específico del checkpoint (null = usar default)
   * @param familyRadiusMeters     - Radio por defecto de la familia
   * @returns Radio efectivo en metros
   */
  static effectiveRadius(
    checkpointRadiusMeters: number | null | undefined,
    familyRadiusMeters: number
  ): number {
    return checkpointRadiusMeters != null ? checkpointRadiusMeters : familyRadiusMeters
  }

  /**
   * Valida si las coordenadas del guardia están dentro del geofence del checkpoint.
   *
   * @param checkpointCoords       - Coordenadas del checkpoint
   * @param guardCoords            - Coordenadas del guardia
   * @param checkpointRadiusMeters - Radio específico del checkpoint (null = usar default)
   * @param familyRadiusMeters     - Radio por defecto de la familia
   * @returns Resultado con isValid, distancia calculada y radio efectivo usado
   */
  static isWithinGeofence(
    checkpointCoords: Coordinates,
    guardCoords: Coordinates,
    checkpointRadiusMeters: number | null | undefined,
    familyRadiusMeters: number
  ): GeofenceCheckResult {
    const distanceMeters = this.haversineDistance(checkpointCoords, guardCoords)
    const effectiveRadiusMeters = this.effectiveRadius(checkpointRadiusMeters, familyRadiusMeters)

    return {
      isValid: distanceMeters <= effectiveRadiusMeters,
      distanceMeters,
      effectiveRadiusMeters,
    }
  }
}
