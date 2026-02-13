import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProviderWrapper } from '@/components/providers/session-provider-wrapper'
import { ToastProvider } from '@/components/providers/toast-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from 'sonner'
import { ThemeScript } from '@/components/theme-script'

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
        <ToastProvider>
          <SessionProviderWrapper>{children}</SessionProviderWrapper>
          <Toaster />
          <SonnerToaster position="top-right" richColors />
        </ToastProvider>
      </body>
    </html>
  )
}
