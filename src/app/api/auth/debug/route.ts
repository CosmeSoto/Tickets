import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Verificar variables de entorno críticas
    const envCheck = {
      NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      DATABASE_URL: !!process.env.DATABASE_URL,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      AZURE_AD_CLIENT_ID: !!process.env.AZURE_AD_CLIENT_ID,
      AZURE_AD_CLIENT_SECRET: !!process.env.AZURE_AD_CLIENT_SECRET,
    }

    // Verificar conexión a base de datos
    let dbStatus = 'unknown'
    try {
      const { default: prisma } = await import('@/lib/prisma')
      await prisma.$queryRaw`SELECT 1`
      dbStatus = 'connected'
    } catch (error) {
      dbStatus = 'error: ' + (error as Error).message
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      nextauth: {
        url: process.env.NEXTAUTH_URL,
        secretConfigured: !!process.env.NEXTAUTH_SECRET,
      },
      database: {
        status: dbStatus,
        url: process.env.DATABASE_URL ? 'configured' : 'missing',
      },
      oauth: {
        google: {
          clientId: !!process.env.GOOGLE_CLIENT_ID,
          clientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        },
        azure: {
          clientId: !!process.env.AZURE_AD_CLIENT_ID,
          clientSecret: !!process.env.AZURE_AD_CLIENT_SECRET,
          tenantId: !!process.env.AZURE_AD_TENANT_ID,
        }
      },
      envCheck
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}