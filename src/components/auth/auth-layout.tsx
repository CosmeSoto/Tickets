'use client'

import { SystemLogo } from '@/components/common/system-logo'

/**
 * Layout compartido para páginas de autenticación y páginas públicas.
 * Usa tokens del tema — funciona en light y dark mode.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5 pointer-events-none" />
      <div className="relative w-full max-w-sm sm:max-w-md">
        {children}
      </div>
    </div>
  )
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-lg p-8 space-y-6">
      {children}
    </div>
  )
}

export function AuthHeader({
  title,
  description,
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <SystemLogo size="md" showText={true} />
      {title && <h1 className="text-xl font-semibold text-foreground mt-1">{title}</h1>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

/** Layout para páginas de contenido (términos, privacidad) */
export function PublicPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {children}
      </div>
    </div>
  )
}
