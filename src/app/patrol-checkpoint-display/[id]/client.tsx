'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Loader2, Clock, MapPin, RefreshCw } from 'lucide-react'

interface CheckpointInfo {
  id: string
  name: string
  location: string
  isActive: boolean
  qrType: 'DYNAMIC' | 'STATIC'
  familyId: string
}

interface Props {
  checkpoint: CheckpointInfo | null
  checkpointId: string
  qrWindowMinutes: number
}

export default function PatrolCheckpointDisplayClient({
  checkpoint,
  checkpointId,
  qrWindowMinutes: initialQrWindowMinutes,
}: Props) {
  const [isMounted, setIsMounted] = useState(false)
  const [loading, setLoading] = useState(!checkpoint)
  const [timeLeft, setTimeLeft] = useState(initialQrWindowMinutes * 60)
  const [qrKey, setQrKey] = useState(0)
  const [qrWindowMinutes, setQrWindowMinutes] = useState(initialQrWindowMinutes)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const configIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/patrols/checkpoints/${checkpointId}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.data?.family?.patrolFamilyConfig?.qrWindowMinutes) {
        const newMinutes = data.data.family.patrolFamilyConfig.qrWindowMinutes
        if (newMinutes !== qrWindowMinutes) {
          setQrWindowMinutes(newMinutes)
        }
      }
    } catch {
      // silencioso
    }
  }, [checkpointId, qrWindowMinutes])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return

    const updateTimer = () => {
      const now = Date.now()
      const windowSeconds = qrWindowMinutes * 60
      const currentWindowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds
      const nextWindowStart = currentWindowStart + windowSeconds
      const remaining = nextWindowStart - Math.floor(now / 1000)
      setTimeLeft(Math.max(0, remaining))

      if (remaining <= 1) {
        setQrKey(k => k + 1)
      }
    }

    updateTimer()
    intervalRef.current = setInterval(updateTimer, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isMounted, qrWindowMinutes])

  useEffect(() => {
    if (!isMounted) return

    fetchConfig()
    configIntervalRef.current = setInterval(fetchConfig, 10000) // cada 10 segundos

    return () => {
      if (configIntervalRef.current) clearInterval(configIntervalRef.current)
    }
  }, [isMounted, fetchConfig])

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!isMounted || loading) {
    return (
      <div className='min-h-screen bg-black flex items-center justify-center'>
        <Loader2 className='h-16 w-16 text-white animate-spin' />
      </div>
    )
  }

  if (!checkpoint) {
    return (
      <div className='min-h-screen bg-black flex items-center justify-center text-white p-8 text-center'>
        <div className='space-y-4'>
          <h1 className='text-2xl font-bold text-red-500'>Error</h1>
          <p className='text-gray-400'>Checkpoint no disponible</p>
        </div>
      </div>
    )
  }

  if (!checkpoint.isActive || checkpoint.qrType !== 'DYNAMIC') {
    return (
      <div className='min-h-screen bg-black flex items-center justify-center text-white p-8 text-center'>
        <div className='space-y-4'>
          <h1 className='text-2xl font-bold text-yellow-500'>Checkpoint no disponible</h1>
          <p className='text-gray-400'>Este checkpoint no está activo o no usa QR dinámico</p>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-black text-white flex flex-col items-center justify-center p-4'>
      <div className='text-center space-y-8 max-w-lg w-full'>
        <div className='space-y-2'>
          <h1 className='text-4xl font-bold'>{checkpoint.name}</h1>
          <div className='flex items-center justify-center gap-2 text-gray-400'>
            <MapPin className='h-5 w-5' />
            <p className='text-lg'>{checkpoint.location}</p>
          </div>
        </div>

        <div className='bg-white p-6 rounded-2xl inline-block'>
          <img
            key={qrKey}
            src={`/api/patrols/checkpoints/${checkpointId}/qr-display?t=${Date.now()}`}
            alt='QR Code'
            className='w-80 h-80'
            suppressHydrationWarning
          />
        </div>

        <div className='space-y-4'>
          <div className='flex items-center justify-center gap-3 text-2xl font-mono'>
            <Clock className='h-8 w-8 text-cyan-400' />
            <span className={`${timeLeft <= 30 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
              {formatTimeLeft(timeLeft)}
            </span>
          </div>

          <div className='flex items-center justify-center gap-2 text-xs text-gray-500'>
            <RefreshCw className='h-3 w-3' />
            <span>Ventana de {qrWindowMinutes} minutos</span>
          </div>
        </div>

        <p className='text-gray-500 text-sm'>
          Escanea con tu dispositivo para registrar el check-in
        </p>
      </div>
    </div>
  )
}
