export type { Checkpoint } from '../types'

export interface CheckpointFormData {
  familyId: string
  name: string
  description: string
  location: string
  latitude: string
  longitude: string
  geofenceRadiusMeters: string
  hasConnectivity: boolean
  isSensitive: boolean
  /** Solo al editar: si true regenera el qrSecret y qrStaticToken */
  regenerateSecret?: boolean
}

export const EMPTY_CHECKPOINT_FORM: CheckpointFormData = {
  familyId: '',
  name: '',
  description: '',
  location: '',
  latitude: '',
  longitude: '',
  geofenceRadiusMeters: '',
  hasConnectivity: false, // Default: QR Estático — más seguro para uso impreso
  isSensitive: false,
  regenerateSecret: false,
}
