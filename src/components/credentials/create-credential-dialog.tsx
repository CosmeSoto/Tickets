'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

type Vault = {
  id: string
  name: string
  kind: string
  family?: { name: string } | null
}

interface CreateCredentialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vaults: Vault[]
  onCreated: () => void
  defaultVaultId?: string
  equipmentId?: string
}

function emptyForm(defaultVaultId?: string, equipmentId?: string) {
  return {
    vaultId: defaultVaultId ?? '',
    title: '',
    username: '',
    secret: '',
    url: '',
    notes: '',
    entryType: equipmentId ? 'EQUIPMENT' : 'GENERIC',
    equipmentId: equipmentId ?? '',
  }
}

export function CreateCredentialDialog({
  open,
  onOpenChange,
  vaults,
  onCreated,
  defaultVaultId,
  equipmentId,
}: CreateCredentialDialogProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => emptyForm(defaultVaultId, equipmentId))

  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaultVaultId ?? vaults[0]?.id, equipmentId))
    } else {
      setForm(emptyForm(defaultVaultId, equipmentId))
    }
  }, [open, defaultVaultId, equipmentId, vaults])

  const handleSubmit = async () => {
    if (!form.vaultId || !form.title || !form.secret) {
      toast({
        title: 'Campos requeridos',
        description: 'Bóveda, título y contraseña son obligatorios',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/credentials/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultId: form.vaultId,
          title: form.title,
          username: form.username || undefined,
          secret: form.secret,
          url: form.url || undefined,
          notes: form.notes || undefined,
          entryType: form.entryType,
          equipmentId: form.equipmentId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear')

      toast({ title: 'Credencial creada' })
      onOpenChange(false)
      setForm(emptyForm(defaultVaultId, equipmentId))
      onCreated()
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message ?? 'No se pudo crear la credencial',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Nueva credencial</DialogTitle>
        </DialogHeader>
        <div className='space-y-3 py-2'>
          <div className='space-y-1.5'>
            <Label>Bóveda</Label>
            <Select value={form.vaultId} onValueChange={v => setForm(p => ({ ...p, vaultId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder='Seleccionar bóveda' />
              </SelectTrigger>
              <SelectContent>
                {vaults.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                    {v.family ? ` · ${v.family.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1.5'>
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder='Ej. Admin router piso 3'
            />
          </div>
          <div className='space-y-1.5'>
            <Label>Usuario</Label>
            <Input
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>Contraseña / secreto</Label>
            <Input
              type='password'
              value={form.secret}
              onChange={e => setForm(p => ({ ...p, secret: e.target.value }))}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>URL</Label>
            <Input
              value={form.url}
              onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
              placeholder='https://...'
            />
          </div>
          <div className='space-y-1.5'>
            <Label>Tipo</Label>
            <Select
              value={form.entryType}
              onValueChange={v => setForm(p => ({ ...p, entryType: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='GENERIC'>Genérico</SelectItem>
                <SelectItem value='EQUIPMENT'>Equipo</SelectItem>
                <SelectItem value='LICENSE'>Licencia</SelectItem>
                <SelectItem value='NETWORK'>Red</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!equipmentId && (
            <div className='space-y-1.5'>
              <Label>ID equipo (opcional)</Label>
              <Input
                value={form.equipmentId}
                onChange={e => setForm(p => ({ ...p, equipmentId: e.target.value }))}
              />
            </div>
          )}
          <div className='space-y-1.5'>
            <Label>Notas</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
