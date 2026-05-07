'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AssetRequestCreateForm } from '@/components/inventory/asset-requests/asset-request-create-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function CreateAssetRequestPage() {
  const router = useRouter()

  const handleSuccess = () => {
    router.push('/inventory/asset-requests')
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <div className='container mx-auto py-6 space-y-6'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Link href='/inventory/asset-requests'>
          <Button variant='ghost' size='icon'>
            <ArrowLeft className='h-4 w-4' />
          </Button>
        </Link>
        <div>
          <h1 className='text-3xl font-bold'>Nueva Solicitud de Activo</h1>
          <p className='text-muted-foreground'>Completa el formulario para solicitar un activo</p>
        </div>
      </div>

      {/* Formulario */}
      <AssetRequestCreateForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  )
}
