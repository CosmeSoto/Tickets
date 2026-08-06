'use client'

import { Children, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StaggerGridProps {
  children: ReactNode
  className?: string
  /** Delay entre hijos en segundos */
  stagger?: number
}

/**
 * Grid con entrada escalonada de hijos (staggerChildren).
 * Ideal para filas de StatsCard / SymmetricStatsCard.
 */
export function StaggerGrid({ children, className, stagger = 0.08 }: StaggerGridProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={cn(className)}
      initial='hidden'
      animate='show'
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduceMotion ? 0 : stagger,
          },
        },
      }}
    >
      {Children.map(children, child => (
        <motion.div
          className='min-w-0 h-full'
          variants={{
            hidden: {
              opacity: 0,
              y: reduceMotion ? 0 : 16,
            },
            show: {
              opacity: 1,
              y: 0,
              transition: {
                duration: reduceMotion ? 0 : 0.35,
                ease: [0.25, 0.1, 0.25, 1],
              },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
