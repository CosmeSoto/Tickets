'use client'

import { useState, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Camera,
  Upload,
  Loader2,
  Trash2,
  X
} from 'lucide-react'

interface AvatarUploadModalProps {
  userId: string
  userName: string
  currentAvatar?: string
  isOpen: boolean
  onClose: () => void
  onAvatarUpdated: (newAvatarUrl: string | null) => void
}

export function AvatarUploadModal({
  userId,
  userName,
  currentAvatar,
  isOpen,
  onClose,
  onAvatarUpdated
}: AvatarUploadModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [uploading, setUploading] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Archivo inválido',
        description: 'Por favor selecciona una imagen válida (JPG, PNG, GIF, WebP)',
        variant: 'destructive',
      })
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'La imagen debe ser menor a 5MB',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
    
    // Crear preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewAvatar(e.target?.result as string)
      setShowUploadDialog(true)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', selectedFile)

      const response = await fetch(`/api/users/${userId}/avatar`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        onAvatarUpdated(result.data.avatarUrl)
        setShowUploadDialog(false)
        setSelectedFile(null)
        setPreviewAvatar(null)
        onClose()
        
        toast({
          title: 'Avatar actualizado',
          description: `La foto de perfil de ${userName} se ha actualizado correctamente`,
        })
      } else {
        toast({
          title: 'Error al subir avatar',
          description: result.error || 'No se pudo actualizar la foto de perfil',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor. Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    setUploading(true)
    try {
      const response = await fetch(`/api/users/${userId}/avatar`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        onAvatarUpdated(null)
        setShowRemoveDialog(false)
        onClose()
        
        toast({
          title: 'Avatar eliminado',
          description: `La foto de perfil de ${userName} se ha eliminado correctamente`,
        })
      } else {
        toast({
          title: 'Error al eliminar avatar',
          description: result.error || 'No se pudo eliminar la foto de perfil',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error removing avatar:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor. Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      {/* Modal principal */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gestionar Avatar</DialogTitle>
            <DialogDescription>
              Actualiza la foto de perfil de {userName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4 py-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={currentAvatar || ''} alt={userName} />
              <AvatarFallback className="text-lg">
                {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex space-x-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                size="sm"
              >
                <Camera className="h-4 w-4 mr-2" />
                {currentAvatar ? 'Cambiar Foto' : 'Subir Foto'}
              </Button>
              
              {currentAvatar && (
                <Button
                  variant="outline"
                  onClick={() => setShowRemoveDialog(true)}
                  disabled={uploading}
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de subida */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar nueva foto</DialogTitle>
            <DialogDescription>
              ¿Te gusta cómo se ve la nueva foto de perfil?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Avatar className="h-32 w-32">
              <AvatarImage src={previewAvatar || ''} alt="Preview" />
              <AvatarFallback className="text-xl">
                {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadDialog(false)
                setPreviewAvatar(null)
                setSelectedFile(null)
              }}
              disabled={uploading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Upload className="h-4 w-4 mr-2" />
              Subir Foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de eliminación */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar foto de perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la foto de perfil de {userName}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={uploading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={uploading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}