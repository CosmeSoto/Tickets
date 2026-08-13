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
import { MaintenanceGuard } from '@/components/auth/maintenance-guard'
import { GlobalFavicon } from '@/components/common/global-favicon'
import { DynamicPageTitle } from '@/components/common/dynamic-page-title'
import { DEFAULT_PAGE_TITLE, getSystemBranding } from '@/lib/branding'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
})

const DEFAULT_DESCRIPTION =
  'Sistema profesional de gestión multi-área: tickets, inventario, rondas y más'

/**
 * Metadata dinámica desde BD:
 * - "Nombre del sistema" (Configuración General) → systemName
 * - "Título principal" (Página Pública) → heroTitle
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const branding = await getSystemBranding()
    return {
      title: branding.pageTitle,
      description: branding.metaDescription,
    }
  } catch {
    return {
      title: DEFAULT_PAGE_TITLE,
      description: DEFAULT_DESCRIPTION,
    }
  }
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
                <GlobalFavicon />
                <DynamicPageTitle defaultTitle={DEFAULT_PAGE_TITLE} />
                <SessionTimeoutMonitor />
                <MaintenanceGuard />
                {children}
              </AppDataProvider>
            </SessionProviderWrapper>
            <Toaster />
            <SonnerToaster position='top-right' richColors />
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
