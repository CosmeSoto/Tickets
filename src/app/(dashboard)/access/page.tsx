import { AccessConsole } from '@/components/access/access-console'
import { ModuleLayout } from '@/components/common/layout/module-layout'

export default function AccessPage() {
  return (
    <ModuleLayout
      title='Accesos'
      subtitle='Emite y verifica pases QR de personal externo, visitantes y contratistas.'
    >
      <AccessConsole />
    </ModuleLayout>
  )
}
