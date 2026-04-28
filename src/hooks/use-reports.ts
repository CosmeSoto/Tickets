/**
 * Custom hook for Reports module
 * Centralizes all business logic and state management
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import type {
  Family,
  FamilyExecutiveSummary,
  TechnicianPerformance,
  TemporalTrendPoint,
  SLAComplianceRow,
  SatisfactionReport,
  ReportTab,
  Granularity,
} from '@/components/reports/utils/report-types'
import {
  exportExecutiveCSV,
  exportTechniciansCSV,
  exportTrendsCSV,
  exportSLACSV,
  exportSatisfactionCSV,
  exportPDF,
} from '@/components/reports/utils/report-exporters'

export function useReports() {
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true

  // ── State ──
  const [families, setFamilies] = useState<Family[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<ReportTab>('executive')
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // ── Data ──
  const [executiveData, setExecutiveData] = useState<FamilyExecutiveSummary[]>([])
  const [techniciansData, setTechniciansData] = useState<TechnicianPerformance[]>([])
  const [trendsData, setTrendsData] = useState<TemporalTrendPoint[]>([])
  const [slaData, setSlaData] = useState<SLAComplianceRow[]>([])
  const [satisfactionData, setSatisfactionData] = useState<SatisfactionReport | null>(null)

  // ── Loading states ──
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Audit log helper ──
  const logExport = useCallback(
    async (format: string) => {
      try {
        await fetch('/api/audit/export-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'REPORT_EXPORTED',
            format,
            familyId: selectedFamilyId,
            tab: activeTab,
          }),
        })
      } catch {
        // Non-critical — don't block export
      }
    },
    [selectedFamilyId, activeTab]
  )

  // ── Load families list ──
  useEffect(() => {
    async function loadFamilies() {
      try {
        const res = await fetch('/api/families')
        const json = await res.json()
        if (json.success) {
          setFamilies(json.data ?? [])
        }
      } catch {
        // ignore
      } finally {
        setLoadingFamilies(false)
      }
    }
    loadFamilies()
  }, [])

  // ── Load report data ──
  const loadReportData = useCallback(async () => {
    setLoadingData(true)
    setError(null)
    try {
      const familyParam = selectedFamilyId === 'all' ? 'all' : selectedFamilyId
      const baseUrl =
        familyParam === 'all' ? '/api/reports/families' : `/api/reports/families/${familyParam}`

      // Build date query params
      const dateParams = new URLSearchParams()
      if (startDate) dateParams.set('startDate', startDate)
      if (endDate) dateParams.set('endDate', endDate)
      const dateSuffix = dateParams.toString() ? `&${dateParams.toString()}` : ''
      const dateQuery = dateParams.toString() ? `?${dateParams.toString()}` : ''

      if (activeTab === 'executive') {
        const url =
          familyParam === 'all'
            ? `${baseUrl}${dateQuery}`
            : `${baseUrl}?type=executive${dateSuffix}`
        const res = await fetch(url)
        const json = await res.json()
        if (json.success) setExecutiveData(Array.isArray(json.data) ? json.data : [json.data])
      } else if (activeTab === 'technicians') {
        const res = await fetch(`${baseUrl}?type=technicians${dateSuffix}`)
        const json = await res.json()
        if (json.success) setTechniciansData(json.data ?? [])
      } else if (activeTab === 'trends') {
        const res = await fetch(`${baseUrl}?type=trends&granularity=${granularity}${dateSuffix}`)
        const json = await res.json()
        if (json.success) setTrendsData(json.data ?? [])
      } else if (activeTab === 'sla') {
        const res = await fetch(`${baseUrl}?type=sla${dateSuffix}`)
        const json = await res.json()
        if (json.success) setSlaData(json.data ?? [])
      } else if (activeTab === 'satisfaction') {
        const res = await fetch(`${baseUrl}?type=satisfaction${dateSuffix}`)
        const json = await res.json()
        if (json.success) setSatisfactionData(json.data ?? null)
      }
    } catch {
      setError('Error al cargar los datos del reporte.')
    } finally {
      setLoadingData(false)
    }
  }, [selectedFamilyId, activeTab, granularity, startDate, endDate])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  // ── Computed values ──
  const selectedFamily = families.find(f => f.id === selectedFamilyId) ?? null
  const familyDisplayName = selectedFamily ? selectedFamily.name : 'Todas las familias'

  // ── CSV export handlers ──
  const handleExportCSV = useCallback(() => {
    if (activeTab === 'executive') exportExecutiveCSV(executiveData, familyDisplayName)
    else if (activeTab === 'technicians') exportTechniciansCSV(techniciansData, familyDisplayName)
    else if (activeTab === 'trends') exportTrendsCSV(trendsData, familyDisplayName)
    else if (activeTab === 'sla') exportSLACSV(slaData, familyDisplayName)
    else if (activeTab === 'satisfaction' && satisfactionData)
      exportSatisfactionCSV(satisfactionData, familyDisplayName)
    void logExport('csv')
  }, [
    activeTab,
    executiveData,
    techniciansData,
    trendsData,
    slaData,
    satisfactionData,
    familyDisplayName,
    logExport,
  ])

  // ── PDF export handler ──
  const handleExportPDF = useCallback(() => {
    exportPDF(
      selectedFamily,
      activeTab,
      executiveData,
      techniciansData,
      trendsData,
      slaData,
      satisfactionData,
      granularity
    )
    void logExport('pdf')
  }, [
    selectedFamily,
    activeTab,
    executiveData,
    techniciansData,
    trendsData,
    slaData,
    satisfactionData,
    granularity,
    logExport,
  ])

  // ── Clear date filters ──
  const clearDateFilters = useCallback(() => {
    setStartDate('')
    setEndDate('')
  }, [])

  return {
    // Session
    isSuperAdmin,

    // State
    families,
    selectedFamilyId,
    setSelectedFamilyId,
    activeTab,
    setActiveTab,
    granularity,
    setGranularity,
    startDate,
    setStartDate,
    endDate,
    setEndDate,

    // Data
    executiveData,
    techniciansData,
    trendsData,
    slaData,
    satisfactionData,

    // Loading states
    loadingFamilies,
    loadingData,
    error,

    // Computed
    selectedFamily,
    familyDisplayName,

    // Actions
    loadReportData,
    handleExportCSV,
    handleExportPDF,
    clearDateFilters,
  }
}
