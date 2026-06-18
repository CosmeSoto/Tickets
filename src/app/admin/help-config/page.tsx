'use client'

// PÁGINA DEDICADA PARA LA CONFIGURACIÓN DE LA PÁGINA PÚBLICA
// NO ES NECESARIO AGREGARLA NUEVAMENTE EN "CONFIGURACIÓN DEL SISTEMA"
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { LandingPageCMSTab } from '@/components/settings/landing-page-cms-tab'

export default function HelpConfigPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.role !== 'ADMIN') {
      router.push('/login')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <ModuleLayout title='Página Pública' loading={true}>
        <div />
      </ModuleLayout>
    )
  }

  if (!session || session.user.role !== 'ADMIN') return null

  const isSuperAdmin = (session.user as any).isSuperAdmin === true

  return (
    <ModuleLayout
      title='Página Pública'
      subtitle='Personaliza el contenido y apariencia de la página de inicio pública'
    >
      <LandingPageCMSTab isSuperAdmin={isSuperAdmin} />
    </ModuleLayout>
  )
}
