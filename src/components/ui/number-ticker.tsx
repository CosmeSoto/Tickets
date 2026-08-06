'use client'

import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface NumberTickerProps {
  value: number
  className?: string
  /** Sufijo estático (ej. "%") */
  suffix?: string
  decimalPlaces?: number
}

function formatNumber(value: number, decimalPlaces: number, suffix: string) {
  if (!Number.isFinite(value)) {
    return `0${suffix}`
  }
  return Intl.NumberFormat('es-MX').format(Number(value.toFixed(decimalPlaces))) + suffix
}

/**
 * Contador animado desde 0 hasta el valor (estilo Magic UI).
 * Respeta prefers-reduced-motion. Evita flash de "0" en SSR.
 */
export function NumberTicker({
  value,
  className,
  suffix = '',
  decimalPlaces = 0,
}: NumberTickerProps) {
  const safeValue = Number.isFinite(value) ? value : 0
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(safeValue)
  const reduceMotion = useReducedMotion()
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  })
  const isInView = useInView(ref, { once: true, margin: '0px' })
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!isInView) return

    if (reduceMotion) {
      if (ref.current) {
        ref.current.textContent = formatNumber(safeValue, decimalPlaces, suffix)
      }
      return
    }

    if (!hasAnimated.current) {
      hasAnimated.current = true
      motionValue.set(0)
      const id = requestAnimationFrame(() => {
        motionValue.set(safeValue)
      })
      return () => {
        cancelAnimationFrame(id)
      }
    }

    motionValue.set(safeValue)
    return
  }, [isInView, safeValue, motionValue, reduceMotion, decimalPlaces, suffix])

  useEffect(() => {
    if (reduceMotion) return
    const unsubscribe = springValue.on('change', latest => {
      if (ref.current) {
        ref.current.textContent = formatNumber(latest, decimalPlaces, suffix)
      }
    })
    return unsubscribe
  }, [springValue, decimalPlaces, suffix, reduceMotion])

  return (
    <span
      ref={ref}
      suppressHydrationWarning
      className={cn('inline-block tabular-nums tracking-tight', className)}
    >
      {formatNumber(safeValue, decimalPlaces, suffix)}
    </span>
  )
}

/**
 * Renderiza un valor de stats: anima números, deja strings compuestos intactos
 * salvo patrones simples como "45%" o "4.5/5".
 */
export function AnimatedStatValue({
  value,
  className,
}: {
  value: string | number
  className?: string
}) {
  if (typeof value === 'number') {
    return <NumberTicker value={value} className={className} />
  }

  const percentMatch = value.match(/^([\d.]+)\s*%$/)
  if (percentMatch) {
    return (
      <NumberTicker
        value={parseFloat(percentMatch[1])}
        suffix='%'
        decimalPlaces={percentMatch[1].includes('.') ? 1 : 0}
        className={className}
      />
    )
  }

  const scoreMatch = value.match(/^([\d.]+)\s*\/\s*([\d.]+)$/)
  if (scoreMatch) {
    const decimals = scoreMatch[1].includes('.') ? 1 : 0
    return (
      <span className={cn('inline-flex items-baseline', className)}>
        <NumberTicker value={parseFloat(scoreMatch[1])} decimalPlaces={decimals} />
        <span className='text-muted-foreground font-medium'>/{scoreMatch[2]}</span>
      </span>
    )
  }

  return <span className={className}>{value}</span>
}
