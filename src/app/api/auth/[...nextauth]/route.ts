import NextAuth from 'next-auth'
import { getAuthOptions } from '@/lib/auth'

async function handler(
  req: Request,
  ctx: { params: Promise<{ nextauth: string[] }> }
) {
  const authOptions = await getAuthOptions()
  return NextAuth(authOptions)(req, ctx)
}

export { handler as GET, handler as POST }
