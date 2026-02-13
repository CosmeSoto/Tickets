import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    encryptionKeySet: !!process.env.ENCRYPTION_KEY,
    encryptionKeyLength: process.env.ENCRYPTION_KEY?.length || 0,
    nodeEnv: process.env.NODE_ENV,
    // Mostrar solo los últimos 8 caracteres para seguridad
    encryptionKeyPreview: process.env.ENCRYPTION_KEY 
      ? '***' + process.env.ENCRYPTION_KEY.slice(-8) 
      : 'NOT SET',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('ENCRYPTION') || k.includes('NEXTAUTH'))
  })
}
