import type { ActStatus, EquipmentCondition } from '@prisma/client'

// User info for act snapshots
export interface UserInfo {
  id: string
  name: string
  email: string
  role: string
  department?: string
}

// Digital signature
export interface DigitalSignature {
  timestamp: Date
  ipAddress: string
  userAgent: string
  hash: string // SHA-256
}

// Delivery Act interface
export interface DeliveryAct {
  id: string
  folio: string
  assignmentId: string
  equipmentSnapshot: Record<string, any>
  delivererInfo: UserInfo
  receiverInfo: UserInfo
  accessories: string[]
  observations?: string
  termsVersion: string
  status: ActStatus
  acceptanceToken: string
  expirationDate: Date
  acceptedAt?: Date
  rejectedAt?: Date
  rejectionReason?: string
  signatureTimestamp?: Date
  signatureIp?: string
  signatureUserAgent?: string
  verificationHash?: string
  pdfPath?: string
  createdAt: Date
  updatedAt: Date
  assignment?: any
}

// Return Act interface
export interface ReturnAct {
  id: string
  folio: string
  assignmentId: string
  deliveryActId: string
  equipmentCondition: EquipmentCondition
  inspectionNotes?: string
  returnDate: Date
  receiverInfo: UserInfo
  delivererInfo: UserInfo
  status: ActStatus
  acceptanceToken: string
  expirationDate: Date
  acceptedAt?: Date
  rejectedAt?: Date
  rejectionReason?: string
  signatureTimestamp?: Date
  signatureIp?: string
  signatureUserAgent?: string
  verificationHash?: string
  pdfPath?: string
  createdAt: Date
  updatedAt: Date
  assignment?: any
}

// Act acceptance request
export interface ActAcceptanceRequest {
  token: string
  acceptedTerms: boolean
}

// Act rejection request
export interface ActRejectionRequest {
  token: string
  reason: string
}

// Act verification request
export interface ActVerificationRequest {
  hash: string
}

// Act verification response
export interface ActVerificationResponse {
  isValid: boolean
  act?: DeliveryAct | ReturnAct
  message: string
}
