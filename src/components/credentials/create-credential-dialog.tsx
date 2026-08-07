'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle2, Copy, Eye, EyeOff, ExternalLink, Loader2 } from 'lucide-react'

type Vault = {
  id: string
  name: string
  kind: string
  familyId?: string | null
  family?: { id?: string; name: string; order?: number } | null
}

interface CreateCredentialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vaults: Vault[]
  onCreated: () => void
  defaultVaultId?: string
  equipmentId?: string
  licenseId?: string
}

type EntryType = 'GENERIC' | 'EQUIPMENT' | 'LICENSE' | 'NETWORK' | 'SERVICE'

type FormState = {
  vaultId: string
  title: string
  username: string
  secret: string
  url: string
  notes: string
  entryType: EntryType
  equipmentId: string
  licenseId: string
}

type CreatedSnapshot = {
  id: string
  title: string
  username: string
  secret: string
  url: string
}

function vaultLabel(v: Vault): string {
  if (v.kind === 'PERSONAL') return `${v.name} · Personal`
  if (v.family?.name) return `${v.family.name} · ${v.name}`
  return v.name
}

function emptyForm(defaultVaultId?: string, equipmentId?: string, licenseId?: string): FormState {
  return {
    vaultId: defaultVaultId ?? '',
    title: '',
    username: '',
    secret: '',
    url: '',
    notes: '',
    entryType: equipmentId ? 'EQUIPMENT' : licenseId ? 'LICENSE' : 'GENERIC',
    equipmentId: equipmentId ?? '',
    licenseId: licenseId ?? '',
  }
}

export function CreateCredentialDialog({
  open,
  onOpenChange,
  vaults,
  onCreated,
  defaultVaultId,
  equipmentId,
  licenseId,
}: CreateCredentialDialogProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [form, setForm] = useState(() => emptyForm(defaultVaultId, equipmentId, licenseId))
  const [linkOptions, setLinkOptions] = useState<Array<{ value: string; label: string }>>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [created, setCreated] = useState<CreatedSnapshot | null>(null)
  const wasOpen = useRef(false)

  const sortedVaults = useMemo(() => {
    return [...vaults].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'AREA' ? -1 : 1
      const ao = a.family?.order ?? 9999
      const bo = b.family?.order ?? 9999
      if (ao !== bo) return ao - bo
      const an = a.family?.name ?? a.name
      const bn = b.family?.name ?? b.name
      const byFamily = an.localeCompare(bn, 'es')
      if (byFamily !== 0) return byFamily
      return a.name.localeCompare(b.name, 'es')
    })
  }, [vaults])

  const selectedVault = sortedVaults.find(v => v.id === form.vaultId)
  const familyId = selectedVault?.familyId ?? selectedVault?.family?.id ?? null
  const lockEquipment = Boolean(equipmentId)
  const lockLicense = Boolean(licenseId)
  const needsEquipmentPicker = form.entryType === 'EQUIPMENT' && !lockEquipment
  const needsLicensePicker = form.entryType === 'LICENSE' && !lockLicense

  // Solo resetear al ABRIR el modal (no cuando loadData refresca vaults tras crear)
  useEffect(() => {
    if (open && !wasOpen.current) {
      setCreated(null)
      setShowSecret(false)
      setForm(emptyForm(defaultVaultId ?? sortedVaults[0]?.id, equipmentId, licenseId))
    }
    if (!open && wasOpen.current) {
      setCreated(null)
      setShowSecret(false)
    }
    wasOpen.current = open
  }, [open, defaultVaultId, equipmentId, licenseId, sortedVaults])

  useEffect(() => {
    if (!open || created) return
    if (!familyId || (form.entryType !== 'EQUIPMENT' && form.entryType !== 'LICENSE')) {
      setLinkOptions([])
      return
    }
    if (form.entryType === 'EQUIPMENT' && lockEquipment) return
    if (form.entryType === 'LICENSE' && lockLicense) return

    let cancelled = false
    setLoadingLinks(true)
    const subtype = form.entryType === 'EQUIPMENT' ? 'EQUIPMENT' : 'LICENSE'
    fetch(`/api/credentials/link-targets?familyId=${familyId}&subtype=${subtype}`)
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los activos')
        if (cancelled) return
        setLinkOptions(
          (data.items ?? []).map((item: { id: string; label: string }) => ({
            value: item.id,
            label: item.label,
          }))
        )
      })
      .catch(err => {
        if (!cancelled) {
          setLinkOptions([])
          toast({
            title: 'No se pudo cargar el listado',
            description: err instanceof Error ? err.message : 'Error de red',
            variant: 'destructive',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLinks(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, created, familyId, form.entryType, lockEquipment, lockLicense, toast])

  const handleTypeChange = (entryType: EntryType) => {
    setForm(p => ({
      ...p,
      entryType,
      equipmentId: entryType === 'EQUIPMENT' ? equipmentId || p.equipmentId || '' : '',
      licenseId: entryType === 'LICENSE' ? licenseId || p.licenseId || '' : '',
    }))
  }

  const handleVaultChange = (vaultId: string) => {
    setForm(p => ({
      ...p,
      vaultId,
      // Al cambiar de área, limpia enlaces (salvo los fijados por contexto)
      equipmentId: equipmentId ?? '',
      licenseId: licenseId ?? '',
    }))
  }

  const copyText = async (value: string, label: string) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    toast({ title: `${label} copiado` })
  }

  const handleSubmit = async () => {
    if (!form.vaultId || !form.title.trim() || !form.secret) {
      toast({
        title: 'Campos requeridos',
        description: 'Área/bóveda, título y contraseña son obligatorios',
        variant: 'destructive',
      })
      return
    }
    if (form.entryType === 'EQUIPMENT' && !form.equipmentId) {
      toast({
        title: 'Selecciona un equipo',
        description: 'Al tipo Equipo debes enlazar un activo del área',
        variant: 'destructive',
      })
      return
    }
    if (form.entryType === 'LICENSE' && !form.licenseId) {
      toast({
        title: 'Selecciona una licencia',
        description: 'Al tipo Licencia debes enlazar una licencia del área',
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
          title: form.title.trim(),
          username: form.username.trim() || undefined,
          secret: form.secret,
          url: form.url.trim() || undefined,
          notes: form.notes.trim() || undefined,
          entryType: form.entryType,
          equipmentId: form.entryType === 'EQUIPMENT' ? form.equipmentId || undefined : undefined,
          licenseId: form.entryType === 'LICENSE' ? form.licenseId || undefined : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detailMsg =
          typeof data?.details?.fieldErrors === 'object'
            ? Object.values(data.details.fieldErrors as Record<string, string[]>)
                .flat()
                .filter(Boolean)[0]
            : undefined
        throw new Error(detailMsg || data.error || `No se pudo crear (${res.status})`)
      }

      setCreated({
        id: data.entry?.id,
        title: form.title.trim(),
        username: form.username.trim(),
        secret: form.secret,
        url: data.entry?.url || form.url.trim(),
      })
      toast({
        title: 'Credencial creada',
        description:
          'Ya puedes copiar usuario o contraseña. El secreto no se vuelve a mostrar sin revelar.',
      })
      onCreated()
    } catch (err: unknown) {
      toast({
        title: 'No se pudo crear la credencial',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCreated(null)
      setShowSecret(false)
      setForm(emptyForm(defaultVaultId, equipmentId, licenseId))
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{created ? 'Credencial lista' : 'Nueva credencial'}</DialogTitle>
          <DialogDescription>
            {created
              ? 'Copia lo que necesites ahora. Después solo se podrá ver con «Revelar» (queda auditado).'
              : 'Guarda accesos por área. El secreto se cifra; solo se revela con auditoría.'}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className='space-y-4 py-2'>
            <div className='flex items-start gap-3 rounded-lg border bg-muted/40 p-4'>
              <CheckCircle2 className='h-5 w-5 text-emerald-600 mt-0.5 shrink-0' />
              <div className='min-w-0'>
                <p className='font-medium'>{created.title}</p>
                <p className='text-sm text-muted-foreground'>
                  Guardada en la bóveda. Usa los botones para copiar sin volver a revelar.
                </p>
              </div>
            </div>

            {created.username ? (
              <div className='space-y-1.5'>
                <Label>Usuario</Label>
                <div className='flex gap-2'>
                  <Input readOnly value={created.username} className='font-mono text-sm' />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    onClick={() => copyText(created.username, 'Usuario')}
                  >
                    <Copy className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            ) : null}

            <div className='space-y-1.5'>
              <Label>Contraseña / secreto</Label>
              <div className='flex gap-2'>
                <Input
                  readOnly
                  type={showSecret ? 'text' : 'password'}
                  value={created.secret}
                  className='font-mono text-sm'
                />
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  onClick={() => setShowSecret(s => !s)}
                  title={showSecret ? 'Ocultar' : 'Mostrar'}
                >
                  {showSecret ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  onClick={() => copyText(created.secret, 'Contraseña')}
                  title='Copiar contraseña'
                >
                  <Copy className='h-4 w-4' />
                </Button>
              </div>
            </div>

            {created.url ? (
              <Button variant='outline' className='w-full' asChild>
                <a href={created.url} target='_blank' rel='noopener noreferrer'>
                  <ExternalLink className='h-4 w-4 mr-2' />
                  Abrir URL de acceso
                </a>
              </Button>
            ) : null}

            <DialogFooter className='gap-2 sm:gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setCreated(null)
                  setShowSecret(false)
                  setForm(emptyForm(defaultVaultId ?? sortedVaults[0]?.id, equipmentId, licenseId))
                }}
              >
                Crear otra
              </Button>
              <Button type='button' onClick={() => handleClose(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className='space-y-4'
            onSubmit={e => {
              e.preventDefault()
              void handleSubmit()
            }}
            autoComplete='off'
          >
            <div className='grid gap-4 py-2 sm:grid-cols-2'>
              <div className='space-y-1.5 sm:col-span-2'>
                <Label>Área / bóveda</Label>
                <Select value={form.vaultId} onValueChange={handleVaultChange}>
                  <SelectTrigger>
                    <SelectValue placeholder='Seleccionar área' />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedVaults.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {vaultLabel(v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1.5 sm:col-span-2'>
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
                  placeholder='Opcional'
                  autoComplete='off'
                />
              </div>

              <div className='space-y-1.5'>
                <Label>Contraseña / secreto</Label>
                <div className='flex gap-2'>
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={form.secret}
                    onChange={e => setForm(p => ({ ...p, secret: e.target.value }))}
                    autoComplete='new-password'
                    className='font-mono'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    onClick={() => setShowSecret(s => !s)}
                    title={showSecret ? 'Ocultar' : 'Ver antes de guardar'}
                  >
                    {showSecret ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                  </Button>
                </div>
                <p className='text-xs text-muted-foreground'>
                  Usa el ojo para verificar tipeo antes de guardar.
                </p>
              </div>

              <div className='space-y-1.5'>
                <Label>Tipo</Label>
                <Select
                  value={form.entryType}
                  onValueChange={v => handleTypeChange(v as EntryType)}
                  disabled={lockEquipment || lockLicense}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='GENERIC'>Genérico</SelectItem>
                    <SelectItem value='EQUIPMENT' disabled={!familyId && !lockEquipment}>
                      Equipo (enlace a inventario)
                    </SelectItem>
                    <SelectItem value='LICENSE' disabled={!familyId && !lockLicense}>
                      Licencia (enlace a inventario)
                    </SelectItem>
                    <SelectItem value='NETWORK'>Red / acceso</SelectItem>
                    <SelectItem value='SERVICE'>Servicio / portal</SelectItem>
                  </SelectContent>
                </Select>
                {!familyId && !lockEquipment && !lockLicense ? (
                  <p className='text-xs text-muted-foreground'>
                    Equipo y Licencia solo están disponibles en bóvedas de área.
                  </p>
                ) : null}
              </div>

              <div className='space-y-1.5'>
                <Label>URL de acceso (opcional)</Label>
                <Input
                  value={form.url}
                  onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  placeholder='https://panel… o 192.168.1.1'
                />
                <p className='text-xs text-muted-foreground'>
                  Enlace al sitio o panel donde se usa esta clave (router, SaaS, VPN). Desde la
                  tarjeta podrás abrirlo; no es obligatorio.
                </p>
              </div>

              {needsEquipmentPicker && (
                <div className='space-y-1.5 sm:col-span-2'>
                  <Label>Equipo enlazado</Label>
                  {!familyId ? (
                    <p className='text-sm text-muted-foreground'>
                      Elige primero una bóveda de área para listar equipos.
                    </p>
                  ) : loadingLinks ? (
                    <div className='flex items-center gap-2 text-sm text-muted-foreground py-2'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Cargando equipos del área…
                    </div>
                  ) : (
                    <SearchableSelect
                      options={linkOptions}
                      value={form.equipmentId}
                      onChange={v => setForm(p => ({ ...p, equipmentId: v }))}
                      placeholder='Buscar por código, nombre o serie…'
                      emptyLabel='Sin enlace'
                    />
                  )}
                </div>
              )}

              {needsLicensePicker && (
                <div className='space-y-1.5 sm:col-span-2'>
                  <Label>Licencia enlazada</Label>
                  {!familyId ? (
                    <p className='text-sm text-muted-foreground'>
                      Elige primero una bóveda de área para listar licencias.
                    </p>
                  ) : loadingLinks ? (
                    <div className='flex items-center gap-2 text-sm text-muted-foreground py-2'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Cargando licencias del área…
                    </div>
                  ) : (
                    <SearchableSelect
                      options={linkOptions}
                      value={form.licenseId}
                      onChange={v => setForm(p => ({ ...p, licenseId: v }))}
                      placeholder='Buscar licencia…'
                      emptyLabel='Sin enlace'
                    />
                  )}
                </div>
              )}

              {(lockEquipment || lockLicense) && (
                <div className='sm:col-span-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground'>
                  {lockEquipment
                    ? 'Esta credencial quedará enlazada al equipo actual de la ficha.'
                    : 'Esta credencial quedará enlazada a la licencia actual.'}
                </div>
              )}

              <div className='space-y-1.5 sm:col-span-2'>
                <Label>Notas</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder='Contexto interno (quién la usa, puerto, etc.)'
                />
              </div>
            </div>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button type='submit' disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
                    Guardando…
                  </>
                ) : (
                  'Crear credencial'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
