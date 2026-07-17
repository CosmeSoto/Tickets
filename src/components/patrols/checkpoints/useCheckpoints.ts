import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { Checkpoint, CheckpointFormData } from './types'
import type { QRPrintItem, PrintFormat } from '@/components/common/qr/qr-print-dialog'
import { printBulkQR } from '@/components/common/qr/qr-bulk-print'
import { formatPatrolLifecycleConflict } from '@/lib/patrol/patrol-lifecycle-messages'

interface UseCheckpointsOptions {
  checkpoints: Checkpoint[]
  reload: () => void
}

export function useCheckpoints({ checkpoints, reload }: UseCheckpointsOptions) {
  const { toast } = useToast()

  // --- State ---
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [permanentlyDeletingId, setPermanentlyDeletingId] = useState<string | null>(null)
  const [downloadingQrId, setDownloadingQrId] = useState<string | null>(null)
  const [displayModalOpen, setDisplayModalOpen] = useState(false)
  const [selectedCheckpointForDisplay, setSelectedCheckpointForDisplay] =
    useState<Checkpoint | null>(null)

  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [printItem, setPrintItem] = useState<QRPrintItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPrinting, setBulkPrinting] = useState(false)

  // --- Helpers ---
  const openCreate = useCallback(() => {
    setEditingId(null)
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((cp: Checkpoint) => {
    setEditingId(cp.id)
    setDialogOpen(true)
  }, [])

  const handleSave = useCallback(
    async (form: CheckpointFormData, families: { id: string; name: string; code: string }[]) => {
      if (!form.name.trim() || !form.location.trim() || !form.familyId) {
        toast({
          title: 'Campos requeridos',
          description: 'Nombre, ubicación y área son obligatorios',
          variant: 'destructive',
        })
        return false
      }

      setSaving(true)
      try {
        const body = {
          familyId: form.familyId,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          location: form.location.trim(),
          latitude: form.latitude ? parseFloat(form.latitude) : undefined,
          longitude: form.longitude ? parseFloat(form.longitude) : undefined,
          geofenceRadiusMeters: form.geofenceRadiusMeters
            ? parseInt(form.geofenceRadiusMeters)
            : undefined,
          hasConnectivity: form.hasConnectivity,
          isSensitive: form.isSensitive,
          // Al editar, pasar regenerateSecret solo si está en true
          ...(editingId && form.regenerateSecret ? { regenerateSecret: true } : {}),
        }

        const res = editingId
          ? await fetch(`/api/patrols/checkpoints/${editingId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
          : await fetch('/api/patrols/checkpoints', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al guardar')

        toast({
          title: editingId ? 'Checkpoint actualizado' : 'Checkpoint creado',
          description:
            editingId && form.regenerateSecret
              ? 'QR regenerado. Descarga e imprime el nuevo código QR.'
              : undefined,
        })
        setDialogOpen(false)
        reload()
        return true
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Error al guardar',
          variant: 'destructive',
        })
        return false
      } finally {
        setSaving(false)
      }
    },
    [editingId, toast, reload]
  )

  const handleDeactivate = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/patrols/checkpoints/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (res.status === 409) {
          const conflict = formatPatrolLifecycleConflict(data, 'desactivar')
          toast({
            title: conflict.title,
            description: conflict.description,
            variant: 'destructive',
          })
          return
        }
        if (!res.ok) throw new Error(data.error ?? 'Error al desactivar')
        toast({
          title: 'Checkpoint desactivado',
          description: 'Ya no podrá usarse en nuevas rutas. El historial se conserva.',
        })
        reload()
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Error',
          variant: 'destructive',
        })
      } finally {
        setDeactivatingId(null)
      }
    },
    [toast, reload]
  )

  const handleReactivate = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/patrols/checkpoints/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Error al reactivar')
        toast({ title: 'Checkpoint reactivado' })
        reload()
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Error',
          variant: 'destructive',
        })
      } finally {
        setReactivatingId(null)
      }
    },
    [toast, reload]
  )

  const handlePermanentDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/patrols/checkpoints/${id}?permanent=true`, {
          method: 'DELETE',
        })
        const data = await res.json()

        if (res.status === 409) {
          const conflict = formatPatrolLifecycleConflict(data, 'eliminar')
          toast({
            title: conflict.title,
            description: conflict.description,
            variant: 'destructive',
          })
          return
        }

        if (!res.ok) throw new Error(data.error ?? 'Error al eliminar permanentemente')
        toast({
          title: data.message ?? 'Checkpoint eliminado permanentemente',
        })
        reload()
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Error',
          variant: 'destructive',
        })
      } finally {
        setPermanentlyDeletingId(null)
      }
    },
    [toast, reload]
  )

  const handleDownloadQR = useCallback(
    async (cp: Checkpoint) => {
      setDownloadingQrId(cp.id)
      try {
        const res = await fetch(`/api/patrols/checkpoints/${cp.id}/qr`)
        if (!res.ok) throw new Error('Error al generar QR')
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `qr-${cp.name.replace(/\s+/g, '-').toLowerCase()}.png`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Error al descargar QR',
          variant: 'destructive',
        })
      } finally {
        setDownloadingQrId(null)
      }
    },
    [toast]
  )

  const handlePrintQR = useCallback(
    async (cp: Checkpoint) => {
      try {
        const res = await fetch(`/api/patrols/checkpoints/${cp.id}/qr`)
        if (!res.ok) throw new Error('Error al generar QR')
        const blob = await res.blob()
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          setPrintItem({ qrSrc: base64, label: cp.name, sublabel: cp.location })
          setPrintDialogOpen(true)
        }
        reader.readAsDataURL(blob)
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Error al preparar QR para impresión',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    const activeIds = checkpoints.filter(cp => cp.isActive).map(cp => cp.id)
    if (activeIds.length > 0 && activeIds.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(activeIds))
    }
  }, [checkpoints, selectedIds])

  const handleBulkPrint = useCallback(async () => {
    if (selectedIds.size === 0) return
    setBulkPrinting(true)

    const selectedCheckpoints = checkpoints.filter(cp => selectedIds.has(cp.id))

    try {
      const items: QRPrintItem[] = []

      await Promise.all(
        selectedCheckpoints.map(async cp => {
          try {
            const res = await fetch(`/api/patrols/checkpoints/${cp.id}/qr`)
            if (!res.ok) return
            const blob = await res.blob()
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
            items.push({ qrSrc: base64, label: cp.name, sublabel: cp.location })
          } catch {
            // Omitir este checkpoint si falla — continúa con los demás
          }
        })
      )

      if (items.length === 0) {
        toast({
          title: 'Error',
          description: 'No se pudieron generar los QR',
          variant: 'destructive',
        })
        return
      }

      let savedFormat: PrintFormat = '57x40'
      try {
        const stored = localStorage.getItem('qr_print_format') as PrintFormat | null
        if (stored) savedFormat = stored
      } catch {
        // silencioso
      }

      printBulkQR(items, savedFormat)
      setSelectedIds(new Set())
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al imprimir en lote',
        variant: 'destructive',
      })
    } finally {
      setBulkPrinting(false)
    }
  }, [checkpoints, selectedIds, toast])

  const openDisplayModal = useCallback((cp: Checkpoint) => {
    setSelectedCheckpointForDisplay(cp)
    setDisplayModalOpen(true)
  }, [])

  const fallbackCopy = useCallback((text: string) => {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    try {
      document.execCommand('copy')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
    document.body.removeChild(el)
  }, [])

  const copyDisplayUrl = useCallback(() => {
    if (!selectedCheckpointForDisplay) return
    const url = `${window.location.origin}/patrol-checkpoint-display/${selectedCheckpointForDisplay.id}`
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => fallbackCopy(url))
    } else {
      fallbackCopy(url)
    }
    toast({ title: 'URL copiada al portapapeles' })
  }, [selectedCheckpointForDisplay, toast, fallbackCopy])

  return {
    dialogOpen,
    setDialogOpen,
    editingId,
    setEditingId,
    saving,
    deactivatingId,
    setDeactivatingId,
    reactivatingId,
    setReactivatingId,
    permanentlyDeletingId,
    setPermanentlyDeletingId,
    downloadingQrId,
    displayModalOpen,
    setDisplayModalOpen,
    selectedCheckpointForDisplay,
    printDialogOpen,
    setPrintDialogOpen,
    printItem,
    selectedIds,
    setSelectedIds,
    bulkPrinting,
    openCreate,
    openEdit,
    handleSave,
    handleDeactivate,
    handleReactivate,
    handlePermanentDelete,
    handleDownloadQR,
    handlePrintQR,
    toggleSelection,
    toggleSelectAll,
    handleBulkPrint,
    copyDisplayUrl,
    openDisplayModal,
  }
}
