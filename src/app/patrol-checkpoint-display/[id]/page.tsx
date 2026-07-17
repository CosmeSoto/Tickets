import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { checkPatrolFamilyOperate } from '@/lib/patrol/patrol-access'
import PatrolCheckpointDisplayClient from './client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PatrolCheckpointDisplayPage({ params }: Props) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const role = session.user.role
  if (role !== 'ADMIN' && role !== 'TECHNICIAN') {
    redirect('/unauthorized')
  }

  const { id } = await params

  const checkpoint = await prisma.patrol_checkpoints.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      location: true,
      isActive: true,
      qrType: true,
      familyId: true,
      family: {
        select: {
          patrolFamilyConfig: {
            select: {
              qrWindowMinutes: true,
            },
          },
        },
      },
    },
  })

  if (!checkpoint) {
    redirect('/unauthorized')
  }

  const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
  const hasAccess = await checkPatrolFamilyOperate(
    session.user.id,
    checkpoint.familyId,
    role,
    isSuperAdmin
  )
  if (!hasAccess) {
    redirect('/unauthorized')
  }

  return (
    <PatrolCheckpointDisplayClient
      checkpoint={checkpoint}
      checkpointId={id}
      qrWindowMinutes={checkpoint.family?.patrolFamilyConfig?.qrWindowMinutes ?? 5}
    />
  )
}
