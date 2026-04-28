/**
 * Types and interfaces for Reports module
 */

export interface Family {
  id: string
  name: string
  code: string
  color: string | null
}

export interface FamilyExecutiveSummary {
  familyId: string
  familyName: string
  familyCode: string
  familyColor: string | null
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  resolvedTickets: number
  closedTickets: number
  avgResolutionTimeMinutes: number | null
  slaComplianceRate: number
}

export interface TechnicianPerformance {
  technicianId: string
  technicianName: string
  technicianEmail: string
  assignedTickets: number
  resolvedTickets: number
  avgResolutionTimeMinutes: number | null
  avgRating: number | null
}

export interface TemporalTrendPoint {
  period: string
  count: number
  familyId?: string
  familyName?: string
}

export interface SLAComplianceRow {
  familyId: string
  familyName: string
  priority: string
  total: number
  compliant: number
  breached: number
  complianceRate: number
}

export interface SatisfactionReport {
  totalRatings: number
  avgRating: number | null
  distribution: Record<number, number>
  categoryAverages: {
    responseTime: number | null
    technicalSkill: number | null
    communication: number | null
    problemResolution: number | null
  }
  satisfactionRate: number | null
  byFamily: {
    familyId: string
    familyName: string
    familyCode: string
    familyColor: string | null
    totalRatings: number
    avgRating: number
    satisfactionRate: number
  }[]
}

export type ReportTab = 'executive' | 'technicians' | 'trends' | 'sla' | 'satisfaction'
export type Granularity = 'day' | 'week' | 'month'
