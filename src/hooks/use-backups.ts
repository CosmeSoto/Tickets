/**
 * Custom hook for Backups module
 * Centralizes all business logic and state management
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

// ── Types ──────────────────────────────────────────────────────────────────

export interface BackupInfo {
  id: string
  filename: string
  size: number
  createdAt: string
  type: 'manual' | 'automatic'
  status: 'completed' | 'failed' | 'in_progress'
  compressed?: boolean
  encrypted?: boolean
  /** null = backup completo */
  module?: string | null
}

export interface BackupStats {
  totalBackups: number
  totalSize: number
  lastBackup?: string
  oldestBackup?: string
  successRate?: number
  avgSize?: number
  compressionRatio?: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatBackupDate(dateString: string): string {
  return new Date(dateString).toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'in_progress':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    default:
      return 'bg-muted text-foreground'
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completado'
    case 'failed':
      return 'Fallido'
    case 'in_progress':
      return 'En Progreso'
    default:
      return status
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useBackups() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  // ── State ──
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [deletingBackup, setDeletingBackup] = useState<BackupInfo | null>(null)
  const [showCleanupDialog, setShowCleanupDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  /** Ámbito del próximo backup manual (completo vs módulo) */
  const [manualBackupScope, setManualBackupScope] = useState<
    'full' | 'tickets' | 'news' | 'patrols' | 'families' | 'audits' | 'configurations'
  >('full')

  // ── Auth check ──
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.role !== 'ADMIN') {
      router.push('/login')
      return
    }
    loadBackups()
    loadStats()
  }, [session, status, router]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load backups ──
  const loadBackups = useCallback(
    async (showToast = false) => {
      setLoading(true)
      try {
        const response = await fetch('/api/admin/backups', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (response.ok) {
          const data = await response.json()
          setBackups(Array.isArray(data) ? data : [])
          if (showToast) {
            toast({
              title: 'Backups actualizados',
              description: 'Lista de backups cargada correctamente',
            })
          }
        } else {
          setBackups([])
          toast({
            title: 'Error al cargar backups',
            description: 'No se pudieron cargar los backups del sistema',
            variant: 'destructive',
          })
        }
      } catch {
        setBackups([])
        toast({
          title: 'Error de conexión',
          description: 'No se pudo conectar con el servidor',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  // ── Load stats ──
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/backups/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch {
      // non-critical
    }
  }, [])

  // ── Refresh ──
  const refreshData = useCallback(() => {
    loadBackups()
    loadStats()
  }, [loadBackups, loadStats])

  // ── Create backup ──
  const createBackup = useCallback(async () => {
    setCreating(true)
    try {
      const response = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'manual',
          ...(manualBackupScope !== 'full' ? { module: manualBackupScope } : {}),
        }),
      })
      if (response.ok) {
        toast({ title: 'Éxito', description: 'Backup creado correctamente' })
        loadBackups(false)
        loadStats()
      } else {
        let message = 'Error al crear backup'
        try {
          const error = await response.json()
          message = error.error || message
        } catch {
          /* cuerpo no JSON */
        }
        toast({
          title: 'Error al crear backup',
          description: message,
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Error al crear backup', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }, [toast, loadBackups, loadStats, manualBackupScope])

  // ── Delete backup ──
  const deleteBackup = useCallback(async () => {
    if (!deletingBackup) return
    const { id: backupId } = deletingBackup
    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/backups/${backupId}`, { method: 'DELETE' })
      if (response.ok) {
        const result = await response.json()
        toast({
          title: 'Backup eliminado',
          description: result.message || 'Backup eliminado correctamente',
        })
        setBackups(prev => prev.filter(b => b.id !== backupId))
        setDeletingBackup(null)
        setTimeout(() => {
          loadBackups()
          loadStats()
        }, 100)
      } else {
        const error = await response.json()
        const isNotFound =
          error.error?.includes('no encontrado') || error.error?.includes('not found')
        if (isNotFound) {
          toast({
            title: 'Backup ya eliminado',
            description: 'El backup ya fue eliminado previamente. Actualizando la lista.',
          })
          setBackups(prev => prev.filter(b => b.id !== backupId))
          setDeletingBackup(null)
          loadBackups()
          loadStats()
        } else {
          toast({
            title: 'Error al eliminar',
            description: error.error || 'Error al eliminar backup',
            variant: 'destructive',
          })
        }
      }
    } catch {
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }, [deletingBackup, toast, loadBackups, loadStats])

  // ── Download backup ──
  const downloadBackup = useCallback(
    async (backupId: string, filename: string) => {
      try {
        const response = await fetch(`/api/admin/backups/${backupId}/download`)
        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        } else {
          toast({
            title: 'Error',
            description: 'No se pudo descargar el backup',
            variant: 'destructive',
          })
        }
      } catch {
        toast({ title: 'Error', description: 'Error al descargar backup', variant: 'destructive' })
      }
    },
    [toast]
  )

  // ── Cleanup failed backups ──
  const cleanupFailedBackups = useCallback(() => {
    const failedCount = backups.filter(b => b.status === 'failed').length
    if (failedCount === 0) {
      toast({ title: 'Sin backups fallidos', description: 'No hay backups fallidos para limpiar' })
      return
    }
    setShowCleanupDialog(true)
  }, [backups, toast])

  const confirmCleanup = useCallback(async () => {
    setCleaning(true)
    try {
      const response = await fetch('/api/admin/backups/cleanup', { method: 'POST' })
      if (response.ok) {
        const result = await response.json()
        toast({ title: 'Limpieza completada', description: result.message })
        loadBackups()
        loadStats()
        setShowCleanupDialog(false)
      } else {
        const error = await response.json()
        toast({
          title: 'Error en limpieza',
          description: error.error || 'Error al limpiar backups fallidos',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive',
      })
    } finally {
      setCleaning(false)
    }
  }, [toast, loadBackups, loadStats])

  // ── Computed ──
  const failedCount = backups.filter(b => b.status === 'failed').length

  return {
    // Session
    session,
    status,

    // Data
    backups,
    stats,
    failedCount,

    // State
    loading,
    creating,
    activeTab,
    setActiveTab,
    deletingBackup,
    setDeletingBackup,
    showCleanupDialog,
    setShowCleanupDialog,
    deleting,
    cleaning,
    manualBackupScope,
    setManualBackupScope,

    // Actions
    refreshData,
    createBackup,
    deleteBackup,
    downloadBackup,
    cleanupFailedBackups,
    confirmCleanup,
    loadStats,
  }
}
