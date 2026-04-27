'use client'

import { useState, useEffect } from 'react'
import { Upload, Trash2, Download, FileText, File, Loader2, Paperclip, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'
import { extractCatchError } from '@/lib/utils/api-error'

interface Attachment {
  id: string
  originalName: string
  mimeType: string
  size: number
  createdAt: string
  uploader: { id: string; name: string }
}

interface LicenseAttachmentsProps {
  licenseId: string
  canManage: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />
  return <File className="h-4 w-4 text-muted-foreground" />
}

const ACCEPTED = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/jpeg',
  'image/png',
].join(',')

export function LicenseAttachments({ licenseId, canManage }: LicenseAttachmentsProps) {
  const { toast } = useToast()
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null)

  const baseUrl = `/api/inventory/licenses/${licenseId}/attachments`

  useEffect(() => { loadAttachments() }, [licenseId])

  const loadAttachments = async () => {
    try {
      setLoading(true)
      const res = await fetch(baseUrl)
      if (res.ok) setAttachments(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'El límite es 20 MB', variant: 'destructive' })
      return
    }

    try {
      setUploading(true)
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(baseUrl, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al subir')
      }
      const newAttachment = await res.json()
      setAttachments(prev => [newAttachment, ...prev])
      toast({ title: 'Archivo subido', description: file.name })
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'No se pudo subir el archivo', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`${baseUrl}/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAttachments(prev => prev.filter(a => a.id !== deleteTarget.id))
      toast({ title: 'Archivo eliminado' })
    } catch (err) {
      toast({ title: 'Error', description: extractCatchError(err, 'No se pudo eliminar el archivo'), variant: 'destructive' })
    } finally {
      setDeleteTarget(null)
    }
  }

  const downloadFile = (attachment: Attachment) => {
    window.open(`${baseUrl}/${attachment.id}`, '_blank')
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Paperclip className="h-4 w-4" />
              Documentos y Contratos
            </CardTitle>
            <CardDescription>
              Contratos, pólizas y documentos relacionados a la licencia
            </CardDescription>
          </div>
          {canManage && (
            <FileInputWithCamera
              accept={ACCEPTED}
              onChange={handleUpload}
            >
              {({ openFile, openCamera, showCamera }) => (
                <div className="flex items-center gap-1.5">
                  {showCamera && (
                    <Button size="sm" variant="outline" onClick={openCamera} disabled={uploading} title="Tomar foto">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={openFile} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? 'Subiendo...' : showCamera ? 'Archivo' : 'Subir archivo'}
                  </Button>
                </div>
              )}
            </FileInputWithCamera>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Paperclip className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">Sin documentos adjuntos</p>
              {canManage && (
                <p className="text-xs text-muted-foreground mt-1">
                  Sube contratos, pólizas o documentos de la licencia
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center gap-3 py-2.5">
                  <FileIcon mimeType={att.mimeType} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{att.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(att.size)} · {att.uploader.name} · {new Date(att.createdAt).toLocaleDateString('es-EC')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadFile(att)} title="Descargar">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {canManage && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(att)} title="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente <span className="font-medium">&quot;{deleteTarget?.originalName}&quot;</span>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
