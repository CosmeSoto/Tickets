import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProviderWrapper } from '@/components/providers/session-provider-wrapper'
import { QueryProvider } from '@/components/providers/query-provider'
import { ToastProvider } from '@/components/providers/toast-provider'
import { AppDataProvider } from '@/components/providers/app-data-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from 'sonner'
import { ThemeScript } from '@/components/theme-script'
import { SessionTimeoutMonitor } from '@/components/auth/session-timeout-monitor'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sistema de Tickets - Soporte Técnico',
  description: 'Sistema de gestión de tickets de soporte técnico para centro comercial',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='es' suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <QueryProvider>
          <ToastProvider>
            <SessionProviderWrapper>
              <AppDataProvider>
                <SessionTimeoutMonitor />
                {children}
              </AppDataProvider>
            </SessionProviderWrapper>
            <Toaster />
            <SonnerToaster position="top-right" richColors />
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
