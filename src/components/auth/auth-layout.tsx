'use client'

import { Children, type ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { SystemLogo } from '@/components/common/system-logo'
import { cn } from '@/lib/utils'

/** Misma curva que login / stagger-grid del proyecto */
export const AUTH_EASE = [0.25, 0.1, 0.25, 1] as const

/**
 * Layout compartido para páginas de autenticación y páginas públicas.
 * Usa tokens del tema — funciona en light y dark mode.
 * Animaciones de entrada; no altera colores.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion()

  return (
    <div className='min-h-screen flex items-center justify-center bg-background px-4 py-12 relative overflow-hidden'>
      <div className='absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5 pointer-events-none' />

      {/* Ambiente sutil — mismos tokens de color */}
      {!reduceMotion && (
        <>
          <motion.div
            aria-hidden
            className='absolute -top-32 -left-24 w-80 h-80 rounded-full bg-primary/5 pointer-events-none'
            animate={{ y: [0, 20, 0], scale: [1, 1.06, 1] }}
            transition={{ duration: 14, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden
            className='absolute -bottom-40 -right-28 w-96 h-96 rounded-full bg-secondary/5 pointer-events-none'
            animate={{ y: [0, -18, 0], scale: [1, 1.05, 1] }}
            transition={{
              duration: 16,
              repeat: Infinity,
              repeatType: 'mirror',
              ease: 'easeInOut',
              delay: 1.4,
            }}
          />
        </>
      )}

      <motion.div
        className='relative w-full max-w-sm sm:max-w-md'
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.45, ease: AUTH_EASE }}
      >
        {children}
      </motion.div>
    </div>
  )
}

export function AuthCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={cn(
        'bg-card border border-border rounded-2xl shadow-lg p-8 space-y-6',
        className
      )}
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: reduceMotion ? 0 : 0.4,
        ease: AUTH_EASE,
        delay: reduceMotion ? 0 : 0.04,
      }}
    >
      {children}
    </motion.div>
  )
}

export function AuthHeader({
  title,
  description,
}: {
  title?: string
  description?: string
}) {
  const reduceMotion = useReducedMotion()
  const duration = reduceMotion ? 0 : 0.32
  const y = reduceMotion ? 0 : 8

  return (
    <div className='flex flex-col items-center gap-2 text-center'>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration, ease: AUTH_EASE }}
      >
        <SystemLogo size='lg' showText={true} />
      </motion.div>
      <AnimatePresence mode='wait'>
        {title ? (
          <motion.h1
            key={title}
            className='text-xl font-semibold text-foreground mt-1'
            initial={{ opacity: 0, y }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
            transition={{ duration, ease: AUTH_EASE }}
          >
            {title}
          </motion.h1>
        ) : null}
      </AnimatePresence>
      <AnimatePresence mode='wait'>
        {description ? (
          <motion.p
            key={description}
            className='text-sm text-muted-foreground'
            initial={{ opacity: 0, y }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
            transition={{ duration, ease: AUTH_EASE, delay: reduceMotion ? 0 : 0.04 }}
          >
            {description}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/**
 * Transición entre pasos / estados (éxito, error, formularios).
 * Usar con `key` en el hijo para crossfade.
 */
export function AuthStep({
  stepKey,
  children,
  className,
}: {
  stepKey: string
  children: ReactNode
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const y = reduceMotion ? 0 : 10

  return (
    <AnimatePresence mode='wait'>
      <motion.div
        key={stepKey}
        className={className}
        initial={{ opacity: 0, y }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: AUTH_EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Entrada/salida de alertas sin saltos bruscos */
export function AuthAlertMotion({
  show,
  children,
  alertKey,
}: {
  show: boolean
  children: ReactNode
  alertKey?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode='wait'>
      {show ? (
        <motion.div
          key={alertKey ?? 'alert'}
          initial={{ opacity: 0, y: reduceMotion ? 0 : -8, height: reduceMotion ? 'auto' : 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -6, height: reduceMotion ? 'auto' : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.26, ease: AUTH_EASE }}
          className='overflow-hidden'
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/** Micro-interacción de botones primarios / OAuth sin cambiar colores */
export function AuthPressable({
  children,
  disabled,
  className,
}: {
  children: ReactNode
  disabled?: boolean
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      whileHover={reduceMotion || disabled ? undefined : { scale: 1.01 }}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.15, ease: AUTH_EASE }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Contenedor con hijos escalonados (campos de formulario).
 * Cada hijo directo recibe fade-up.
 */
export function AuthStagger({
  children,
  className,
  stagger = 0.05,
}: {
  children: ReactNode
  className?: string
  stagger?: number
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial='hidden'
      animate='show'
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduceMotion ? 0 : stagger,
            delayChildren: reduceMotion ? 0 : 0.06,
          },
        },
      }}
    >
      {Children.map(children, (child: ReactNode) => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: reduceMotion ? 0 : 10 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: reduceMotion ? 0 : 0.32, ease: AUTH_EASE },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}

/** Layout para páginas de contenido (términos, privacidad) */
export function PublicPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-screen bg-background py-12 px-4'>
      <div className='max-w-3xl mx-auto space-y-6'>{children}</div>
    </div>
  )
}
