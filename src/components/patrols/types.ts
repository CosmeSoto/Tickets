export interface PatrolSchedule {
  id: string
  familyId: string
  routeId: string
  agentId: string
  scheduledStart: string
  scheduledEnd: string
  recurrence: string
  recurrenceDays: number[]
  isActive: boolean
  createdAt: string
  route: { id: string; name: string }
  agent: { id: string; name: string; email: string }
}

export interface Family {
  id: string
  name: string
  code: string
}

export interface PatrolRoute {
  id: string
  name: string
  estimatedDurationMinutes: number
}

export interface Agent {
  id: string
  name: string
  email: string
  role: string
}

export interface Checkpoint {
  id: string
  familyId: string
  name: string
  description: string | null
  location: string
  latitude: number | null
  longitude: number | null
  geofenceRadiusMeters: number | null
  hasConnectivity: boolean
  isSensitive: boolean
  isActive: boolean
  qrType: 'DYNAMIC' | 'STATIC'
  createdAt: string
  updatedAt: string
}

export interface FormData {
  familyId: string
  routeId: string
  agentId: string
  scheduledStart: string
  scheduledEnd: string
  endTimeOnly: string
  recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'CUSTOM'
  recurrenceDays: number[]
}

export const EMPTY_FORM: FormData = {
  familyId: '',
  routeId: '',
  agentId: '',
  scheduledStart: '',
  scheduledEnd: '',
  endTimeOnly: '',
  recurrence: 'NONE',
  recurrenceDays: [],
}

export const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
