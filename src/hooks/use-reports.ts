'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { usePagination } from './common/use-pagination'
import { 
  ReportService, 
  ReportFilters, 
  TicketReport, 
  TechnicianReport, 
  CategoryReport 
} from '@/lib/services/report-service'

// Re-exportar para compatibilidad
export type { ReportFilters, TicketReport, TechnicianReport, CategoryReport }

// Tipo para reporte de departamentos
export interface DepartmentReport {
  id: string
  name: string
  description?: string
  color?: string
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  resolvedTickets: number
  closedTickets: number
  avgResolutionTime: string
  resolutionRate: number
  slaCompliance: number
  activeCategories: number
  activeTechnicians: number
}

// Interfaces para datos de referencia
export interface ReferenceData {
  categories: Array<{ id: string; name: string; description?: string; color?: string }>
  technicians: Array<{ id: string; name: string; email: string; department?: string }>
  clients: Array<{ id: string; name: string; email: string }>
  departments: Array<{ id: string; name: string; description?: string; color?: string }>
}

// Configuración del hook
interface UseReportsConfig {
  cacheTTL?: number
  enableCache?: boolean
  autoRefresh?: boolean
  enablePagination?: boolean
  pageSize?: number
}

// Cache simple en memoria
const cache = new Map<string, { data: any; timestamp: number }>()

const getFromCache = <T>(key: string, ttl: number = 5 * 60 * 1000): T | null => {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T
  }
  return null
}

const setToCache = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() })
}

export function useReports(config: UseReportsConfig = {}) {
  const {
    cacheTTL = 5 * 60 * 1000, // 5 minutos
    enableCache = true,
    autoRefresh = false,
    enablePagination = true,
    pageSize = 50,
  } = config

  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  // Estados principales
  const [ticketReport, setTicketReport] = useState<TicketReport | null>(null)
  const [technicianReport, setTechnicianReport] = useState<TechnicianReport[]>([])
  const [categoryReport, setCategoryReport] = useState<CategoryReport[]>([])
  const [departmentReport, setDepartmentReport] = useState<DepartmentReport[]>([])
  const [referenceData, setReferenceData] = useState<ReferenceData>({
    categories: [],
    technicians: [],
    clients: [],
    departments: []
  })

  // Estados de carga
  const [loading, setLoading] = useState(true) // Iniciar como true para mostrar loading inicial
  const [loadingReports, setLoadingReports] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estados de filtros
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 días atrás
    endDate: new Date()
  })

  // Estados de UI
  const [exporting, setExporting] = useState(false)
  const [exportingType, setExportingType] = useState<string | null>(null)

  // Paginación para tickets detallados
  const paginatedTickets = usePagination(
    ticketReport?.detailedTickets || [],
    {
      pageSize
    }
  )

  // Función para cargar datos de referencia (departamentos, categorías, clientes, técnicos)
  const loadReferenceData = useCallback(async () => {
    try {
      // Cargar todos los datos de referencia en paralelo
      const [departmentsRes, categoriesRes, clientsRes, techniciansRes] = await Promise.all([
        fetch('/api/departments?isActive=true'),
        fetch('/api/categories?isActive=true'),
        fetch('/api/users?role=CLIENT&isActive=true'),
        fetch('/api/users?role=TECHNICIAN&isActive=true')
      ])

      // Procesar respuestas
      const [departmentsData, categoriesData, clientsData, techniciansData] = await Promise.all([
        departmentsRes.ok ? departmentsRes.json() : { data: [] },
        categoriesRes.ok ? categoriesRes.json() : { data: [] },
        clientsRes.ok ? clientsRes.json() : { data: [] },
        techniciansRes.ok ? techniciansRes.json() : { data: [] }
      ])

      // Actualizar estado con datos de referencia
      setReferenceData({
        departments: Array.isArray(departmentsData.data) 
          ? departmentsData.data.map((dept: any) => ({
              id: dept.id,
              name: dept.name,
              description: dept.description,
              color: dept.color
            }))
          : [],
        categories: Array.isArray(categoriesData.data)
          ? categoriesData.data.map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              description: cat.description,
              color: cat.color
            }))
          : [],
        clients: Array.isArray(clientsData.data)
          ? clientsData.data.map((client: any) => ({
              id: client.id,
              name: client.name,
              email: client.email
            }))
          : [],
        technicians: Array.isArray(techniciansData.data)
          ? techniciansData.data.map((tech: any) => ({
              id: tech.id,
              name: tech.name,
              email: tech.email,
              department: tech.departments?.name
            }))
          : []
      })

      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Reference data loaded:', {
          departments: departmentsData.data?.length || 0,
          categories: categoriesData.data?.length || 0,
          clients: clientsData.data?.length || 0,
          technicians: techniciansData.data?.length || 0
        })
      }
    } catch (error) {
      console.error('Error loading reference data:', error)
      // No mostrar error al usuario, solo log en consola
      // Los filtros simplemente estarán vacíos si falla
    }
  }, [])

  // Función principal para cargar reportes
  const loadReports = useCallback(async (force = false) => {
    if (!session?.user || session.user.role !== 'ADMIN') {
      setError('No autorizado para ver reportes')
      setLoading(false)
      return
    }

    setLoadingReports(true)
    setError(null)

    try {
      const cacheKey = `reports-${JSON.stringify(filters)}`
      
      // Verificar cache si está habilitado
      if (enableCache && !force) {
        const cached = getFromCache<{
          ticketReport: TicketReport | null
          technicianReport: TechnicianReport[]
          categoryReport: CategoryReport[]
          departmentReport: DepartmentReport[]
        }>(cacheKey, cacheTTL)

        if (cached) {
          setTicketReport(cached.ticketReport)
          setTechnicianReport(Array.isArray(cached.technicianReport) ? cached.technicianReport : [])
          setCategoryReport(Array.isArray(cached.categoryReport) ? cached.categoryReport : [])
          setDepartmentReport(Array.isArray(cached.departmentReport) ? cached.departmentReport : [])
          setLoading(false)
          return
        }
      }

      // Cargar datos frescos
      const [ticketRes, technicianRes, categoryRes, departmentRes] = await Promise.all([
        loadTicketReport(),
        loadTechnicianReport(),
        loadCategoryReport(),
        loadDepartmentReport()
      ])

      const reportData = {
        ticketReport: ticketRes,
        technicianReport: Array.isArray(technicianRes) ? technicianRes : [],
        categoryReport: Array.isArray(categoryRes) ? categoryRes : [],
        departmentReport: Array.isArray(departmentRes) ? departmentRes : []
      }

      // Guardar en cache
      if (enableCache) {
        setToCache(cacheKey, reportData)
      }

      setTicketReport(ticketRes)
      setTechnicianReport(reportData.technicianReport)
      setCategoryReport(reportData.categoryReport)
      setDepartmentReport(reportData.departmentReport)
      setLoading(false)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar reportes'
      setError(errorMessage)
      setLoading(false)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setLoadingReports(false)
    }
  }, [session, filters, enableCache, cacheTTL, toast])

  const loadTicketReport = useCallback(async (): Promise<TicketReport | null> => {
    try {
      const params = new URLSearchParams({
        type: 'tickets',
        format: 'json',
        limit: '5000', // Límite explícito
        ...Object.fromEntries(
          Object.entries(filters).map(([key, value]) => [
            key,
            value instanceof Date ? value.toISOString().split('T')[0] : String(value || '')
          ])
        )
      })

      const response = await fetch(`/api/reports?${params}`)
      if (response.ok) {
        const result = await response.json()
        
        // Mostrar advertencias si las hay
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach((warning: string) => {
            toast({
              title: 'Advertencia de Volumen',
              description: warning,
              variant: 'default'
            })
          })
        }
        
        return result.data || result
      } else {
        throw new Error('Error al cargar reporte de tickets')
      }
    } catch (error) {
      console.error('Error loading ticket report:', error)
      throw error
    }
  }, [filters, toast])

  const loadTechnicianReport = useCallback(async (): Promise<TechnicianReport[]> => {
    try {
      const params = new URLSearchParams({
        type: 'technicians',
        format: 'json',
        ...Object.fromEntries(
          Object.entries(filters).map(([key, value]) => [
            key,
            value instanceof Date ? value.toISOString().split('T')[0] : String(value || '')
          ])
        )
      })

      const response = await fetch(`/api/reports?${params}`)
      if (response.ok) {
        const data = await response.json()
        // Asegurar que siempre retornemos un array
        return Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []
      } else {
        throw new Error('Error al cargar reporte de técnicos')
      }
    } catch (error) {
      console.error('Error loading technician report:', error)
      // Retornar array vacío en caso de error
      return []
    }
  }, [filters])

  const loadCategoryReport = useCallback(async (): Promise<CategoryReport[]> => {
    try {
      const params = new URLSearchParams({
        type: 'categories',
        format: 'json',
        ...Object.fromEntries(
          Object.entries(filters).map(([key, value]) => [
            key,
            value instanceof Date ? value.toISOString().split('T')[0] : String(value || '')
          ])
        )
      })

      const response = await fetch(`/api/reports?${params}`)
      if (response.ok) {
        const data = await response.json()
        // Asegurar que siempre retornemos un array
        return Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []
      } else {
        throw new Error('Error al cargar reporte de categorías')
      }
    } catch (error) {
      console.error('Error loading category report:', error)
      // Retornar array vacío en caso de error
      return []
    }
  }, [filters])

  const loadDepartmentReport = useCallback(async (): Promise<DepartmentReport[]> => {
    try {
      const params = new URLSearchParams({
        type: 'departments',
        format: 'json',
        ...Object.fromEntries(
          Object.entries(filters).map(([key, value]) => [
            key,
            value instanceof Date ? value.toISOString().split('T')[0] : String(value || '')
          ])
        )
      })

      const response = await fetch(`/api/reports?${params}`)
      if (response.ok) {
        const data = await response.json()
        // Asegurar que siempre retornemos un array
        return Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []
      } else {
        throw new Error('Error al cargar reporte de departamentos')
      }
    } catch (error) {
      console.error('Error loading department report:', error)
      // Retornar array vacío en caso de error
      return []
    }
  }, [filters])

  // Función de exportación
  const handleExport = useCallback(async (
    type: string, 
    format: 'csv' | 'excel' | 'pdf' | 'json' = 'csv'
  ) => {
    if (!session?.user || session.user.role !== 'ADMIN') {
      toast({
        title: 'Error de autorización',
        description: 'No tienes permisos para exportar reportes. Contacta al administrador.',
        variant: 'destructive',
        duration: 5000,
      })
      return
    }

    setExporting(true)
    setExportingType(type)

    // Nombres descriptivos para los tipos de reporte
    const reportNames: Record<string, string> = {
      tickets: 'Tickets',
      technicians: 'Técnicos',
      categories: 'Categorías',
    }
    const reportName = reportNames[type] || type

    try {
      const params = new URLSearchParams({
        type,
        format,
        ...Object.fromEntries(
          Object.entries(filters).map(([key, value]) => [
            key,
            value instanceof Date ? value.toISOString().split('T')[0] : String(value || '')
          ])
        )
      })

      const response = await fetch(`/api/reports?${params}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // Obtener nombre del archivo desde headers o generar uno
        const contentDisposition = response.headers.get('content-disposition')
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : `${type}-report-${new Date().toISOString().split('T')[0]}.${format}`
        
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast({
          title: 'Reporte exportado exitosamente',
          description: `El reporte de ${reportName} ha sido descargado como "${filename}"`,
          duration: 4000,
        })
      } else {
        throw new Error('Error al exportar reporte')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast({
        title: 'Error al exportar reporte',
        description: `No se pudo exportar el reporte de ${reportName}. ${errorMessage}`,
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setExporting(false)
      setExportingType(null)
    }
  }, [session, filters, toast])

  // Funciones de filtros
  const applyFilters = useCallback((newFilters: Partial<ReportFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    })
  }, [])

  // Función de refresh
  const refresh = useCallback(() => {
    loadReports(true)
  }, [loadReports])

  // Estadísticas calculadas
  const stats = useMemo(() => {
    // Asegurar que los arrays sean siempre arrays válidos
    const safeTechinicianReport = Array.isArray(technicianReport) ? technicianReport : []
    const safeCategoryReport = Array.isArray(categoryReport) ? categoryReport : []
    const safeDepartmentReport = Array.isArray(departmentReport) ? departmentReport : []
    
    return {
      // Estadísticas de tickets
      totalTickets: ticketReport?.totalTickets || 0,
      openTickets: ticketReport?.openTickets || 0,
      inProgressTickets: ticketReport?.inProgressTickets || 0,
      resolvedTickets: ticketReport?.resolvedTickets || 0,
      closedTickets: ticketReport?.closedTickets || 0,
      avgResolutionTime: ticketReport?.avgResolutionTime || '0h',
      
      // Estadísticas de técnicos
      totalTechnicians: safeTechinicianReport.length,
      activeTechnicians: safeTechinicianReport.filter(t => t.totalAssigned > 0).length,
      avgTechnicianResolutionRate: safeTechinicianReport.length > 0 
        ? (safeTechinicianReport.reduce((acc, t) => acc + t.resolutionRate, 0) / safeTechinicianReport.length).toFixed(1)
        : '0',
      
      // Estadísticas de categorías
      totalCategories: safeCategoryReport.length,
      activeCategories: safeCategoryReport.length,
      avgCategoryResolutionRate: safeCategoryReport.length > 0
        ? (safeCategoryReport.reduce((acc, c) => acc + c.resolutionRate, 0) / safeCategoryReport.length).toFixed(1)
        : '0',
      
      // Estadísticas de departamentos
      totalDepartments: safeDepartmentReport.length,
      activeDepartments: safeDepartmentReport.length,
      avgDepartmentResolutionRate: safeDepartmentReport.length > 0
        ? (safeDepartmentReport.reduce((acc, d) => acc + d.resolutionRate, 0) / safeDepartmentReport.length).toFixed(1)
        : '0',
      
      // Filtros
      hasActiveFilters: Object.values(filters).some(v => v && v !== filters.startDate && v !== filters.endDate),
      filterCount: Object.values(filters).filter(v => v && v !== filters.startDate && v !== filters.endDate).length,
    }
  }, [ticketReport, technicianReport, categoryReport, departmentReport, filters])

  // Verificación de autenticación
  const isAuthenticated = useMemo(() => {
    return session?.user?.role === 'ADMIN'
  }, [session])

  // Redirección si no está autenticado
  useEffect(() => {
    if (session && !isAuthenticated) {
      router.push('/dashboard')
    }
  }, [session, isAuthenticated, router])

  // Determinar si es el mount inicial
  const isInitialMount = useMemo(() => {
    const initial = !ticketReport && !technicianReport.length && !categoryReport.length && !departmentReport.length
    return initial
  }, [ticketReport, technicianReport, categoryReport, departmentReport])

  // Cargar datos de referencia al montar el componente
  useEffect(() => {
    if (isAuthenticated) {
      loadReferenceData()
    }
  }, [isAuthenticated, loadReferenceData])

  // Cargar reportes automáticamente en el mount inicial
  useEffect(() => {
    if (isAuthenticated && isInitialMount) {
      // Cargar datos inmediatamente cuando se monta el componente
      loadReports()
    }
  }, [isAuthenticated, isInitialMount, loadReports])

  // Cargar reportes cuando cambian los filtros (después del mount inicial)
  useEffect(() => {
    if (isAuthenticated && !isInitialMount) {
      const timeoutId = setTimeout(() => {
        loadReports()
      }, 500) // Debounce de 500ms

      return () => clearTimeout(timeoutId)
    }
    return undefined
  }, [filters, isAuthenticated, isInitialMount, loadReports])

  // Auto-refresh si está habilitado
  useEffect(() => {
    if (autoRefresh && isAuthenticated) {
      const interval = setInterval(() => {
        loadReports()
      }, cacheTTL)

      return () => clearInterval(interval)
    }
    return undefined
  }, [autoRefresh, isAuthenticated, loadReports, cacheTTL])

  return {
    // Estados principales
    ticketReport,
    technicianReport,
    categoryReport,
    departmentReport,
    referenceData,
    
    // Estados de carga
    loading,
    loadingReports,
    error,
    
    // Estados de filtros
    filters,
    applyFilters,
    resetFilters,
    
    // Estados de UI
    exporting,
    exportingType,
    
    // Datos procesados
    stats,
    paginatedTickets,
    
    // Funciones principales
    loadReports,
    loadReferenceData,
    handleExport,
    refresh,
    
    // Estados de sesión
    isAuthenticated,
  }
}