/**
 * DELETE /api/planner/ms-todo/disconnect
 * Revoca la conexión de Microsoft To Do del usuario logueado — igual que el
 * flujo de Planner, solo se borra el estado local (Graph no ofrece un
 * endpoint limpio de revocación); las tareas quedan como locales sin
 * sincronizar, sin ningún error.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertCanViewPlanner } from '@/lib/planner/access'
import { MS_TODO_PROVIDER } from '@/lib/services/ms-todo-graph-service'

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const denied = await assertCanViewPlanner(session.user.id, session.user.role)
  if (denied) return denied

  await prisma.oauth_accounts.deleteMany({
    where: { provider: MS_TODO_PROVIDER, providerId: session.user.id },
  })
  // Los vínculos de tareas quedan huérfanos apuntando a un token que ya no
  // existe — se borran para que un futuro reconectar no intente reusarlos
  // contra IDs de tarea que Microsoft ya no reconoce como nuestros.
  await prisma.personal_task_ms_todo_links.deleteMany({ where: { userId: session.user.id } })

  return NextResponse.json({ success: true, message: 'Conexión con Microsoft To Do revocada' })
}
