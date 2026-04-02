import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import prisma from './prisma'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'

export const authOptions: NextAuthOptions = {
  // IMPORTANTE: No usar PrismaAdapter con strategy: 'jwt'
  // El adapter solo es necesario para strategy: 'database'
  // Con JWT, la sesión se almacena en el token, no en la base de datos
  providers: [
    // Proveedor de credenciales (login tradicional)
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email y contraseña son requeridos')
        }

        try {
          // NUEVO: Verificar si la cuenta está bloqueada por intentos fallidos
          const { SecurityConfigService } = await import('./services/security-config-service')
          const ipAddress = 'unknown' // En producción, obtener IP real del request
          
          const lockStatus = await SecurityConfigService.isAccountLocked(credentials.email, ipAddress)
          
          if (lockStatus.locked) {
            // Registrar intento de acceso a cuenta bloqueada
            try {
              const { AuditServiceComplete } = await import('./services/audit-service-complete')
              await AuditServiceComplete.log({
                action: 'login_failed',
                entityType: 'user',
                entityId: 'unknown',
                userId: 'system',
                details: {
                  email: credentials.email,
                  reason: 'account_locked',
                  timestamp: new Date().toISOString()
                },
                result: 'ERROR',
                errorCode: 'AUTH_ACCOUNT_LOCKED',
                errorMessage: 'Cuenta bloqueada por múltiples intentos fallidos'
              })
            } catch (auditError) {
              console.error('[AUTH] Error registrando intento bloqueado:', auditError)
            }
            
            throw new Error('Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo en 30 minutos.')
          }

          const user = await prisma.users.findUnique({
            where: {
              email: credentials.email,
            },
            include: {
              departments: true
            }
          })

          // Usuario no encontrado
          if (!user) {
            // NUEVO: Registrar intento fallido
            await SecurityConfigService.recordFailedLogin(credentials.email, ipAddress)
            throw new Error('Credenciales inválidas')
          }

          // Sin contraseña configurada (usuario OAuth o creado sin password)
          if (!user.passwordHash) {
            console.error(`[AUTH] Usuario ${credentials.email} no tiene passwordHash configurado`)
            throw new Error('Esta cuenta no tiene contraseña configurada. Contacta al administrador.')
          }

          // Usuario desactivado
          if (!user.isActive) {
            // Registrar intento de acceso a cuenta desactivada
            try {
              const { AuditServiceComplete } = await import('./services/audit-service-complete')
              await AuditServiceComplete.log({
                action: 'login_failed',
                entityType: 'user',
                entityId: user.id,
                userId: user.id,
                details: {
                  email: credentials.email,
                  reason: 'account_disabled',
                  timestamp: new Date().toISOString()
                },
                result: 'ERROR',
                errorCode: 'AUTH_ACCOUNT_DISABLED',
                errorMessage: 'Intento de acceso a cuenta desactivada'
              })
            } catch (auditError) {
              console.error('[AUTH] Error registrando intento fallido:', auditError)
            }
            
            throw new Error('Usuario desactivado')
          }

          // Verificar contraseña
          const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash)

          if (!isPasswordValid) {
            // NUEVO: Registrar intento fallido
            await SecurityConfigService.recordFailedLogin(credentials.email, ipAddress)
            
            // Obtener intentos restantes
            const updatedLockStatus = await SecurityConfigService.isAccountLocked(credentials.email, ipAddress)
            
            // Registrar contraseña incorrecta
            try {
              const { AuditServiceComplete } = await import('./services/audit-service-complete')
              await AuditServiceComplete.log({
                action: 'login_failed',
                entityType: 'user',
                entityId: user.id,
                userId: user.id,
                details: {
                  email: credentials.email,
                  reason: 'invalid_password',
                  attemptsRemaining: updatedLockStatus.attemptsRemaining,
                  timestamp: new Date().toISOString()
                },
                result: 'ERROR',
                errorCode: 'AUTH_INVALID_PASSWORD',
                errorMessage: 'Contraseña incorrecta'
              })
            } catch (auditError) {
              console.error('[AUTH] Error registrando intento fallido:', auditError)
            }
            
            const remainingMessage = updatedLockStatus.attemptsRemaining 
              ? ` (${updatedLockStatus.attemptsRemaining} intentos restantes)`
              : ''
            
            throw new Error(`Credenciales inválidas${remainingMessage}`)
          }

          // NUEVO: Login exitoso - limpiar intentos fallidos
          await SecurityConfigService.clearFailedLogins(credentials.email, ipAddress)

          // Login exitoso - actualizar último login
          await prisma.users.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          })

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            departmentId: user.departmentId || undefined,
            department: user.departments?.name || undefined,
            phone: user.phone || undefined,
            avatar: user.avatar || undefined,
          }
        } catch (error) {
          console.error('Auth error:', error)
          throw error
        }
      },
    }),

    // Proveedor de Google OAuth (solo si está configurado)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            prompt: 'consent',
            access_type: 'offline',
            response_type: 'code'
          }
        },
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name,
            email: profile.email,
            image: profile.picture,
            role: 'CLIENT' as UserRole, // Por defecto, los usuarios OAuth son clientes
            emailVerified: profile.email_verified,
          }
        }
      })
    ] : []),

    // Proveedor de Microsoft/Outlook OAuth (solo si está configurado)
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET ? [
      AzureADProvider({
        clientId: process.env.AZURE_AD_CLIENT_ID,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
        tenantId: process.env.AZURE_AD_TENANT_ID || 'common', // 'common' permite cuentas personales y organizacionales
        authorization: {
          params: {
            scope: 'openid profile email User.Read'
          }
        },
        profile(profile) {
          return {
            id: profile.sub || profile.oid,
            name: profile.name,
            email: profile.email || profile.preferred_username,
            image: profile.picture,
            role: 'CLIENT' as UserRole,
            emailVerified: true,
          }
        }
      })
    ] : []),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 horas (máximo permitido, se validará en middleware)
    updateAge: 60 * 60, // Actualizar cada hora
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 horas (máximo permitido, se validará en middleware)
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Si es login con OAuth (Google o Microsoft)
        if (account?.provider === 'google' || account?.provider === 'azure-ad') {
          try {
            // Buscar si el usuario ya existe
            const existingUser = await prisma.users.findUnique({
              where: { email: user.email! }
            })

            if (existingUser) {
              // Usuario existe, actualizar información de OAuth si es necesario
              await prisma.users.update({
                where: { id: existingUser.id },
                data: {
                  lastLogin: new Date(),
                  avatar: user.image || existingUser.avatar,
                  isEmailVerified: true,
                  oauthProvider: account.provider,
                  oauthId: account.providerAccountId,
                }
              })

              // Verificar si está activo
              if (!existingUser.isActive) {
                return false
              }

              return true
            } else {
              // Usuario nuevo, crear cuenta como CLIENT
              const newUser = await prisma.users.create({
                data: {
                  id: randomUUID(),
                  email: user.email!,
                  name: user.name || user.email!.split('@')[0],
                  role: 'CLIENT',
                  avatar: user.image,
                  isActive: true,
                  isEmailVerified: true,
                  oauthProvider: account.provider,
                  oauthId: account.providerAccountId,
                  lastLogin: new Date(),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
              })

              // Crear configuración por defecto (user_settings unificado)
              await prisma.user_settings.upsert({
                where: { userId: newUser.id },
                update: {},
                create: {
                  id: randomUUID(),
                  userId: newUser.id,
                  theme: 'light',
                  timezone: 'America/Guayaquil',
                  language: 'es',
                  updatedAt: new Date(),
                }
              })

              // Crear preferencias de notificación por defecto
              await prisma.notification_preferences.create({
                data: {
                  userId: newUser.id,
                  emailEnabled: true,
                  inAppEnabled: true,
                  ticketCreated: true,
                  ticketUpdated: true,
                  ticketAssigned: true,
                  ticketResolved: true,
                  commentAdded: true,
                }
              })

              return true
            }
          } catch (error) {
            console.error('Error en signIn callback OAuth:', error)
            return false
          }
        }

        // Para login con credenciales, permitir
        return true
      } catch (error) {
        console.error('Error general en signIn callback:', error)
        return false
      }
    },

    async jwt({ token, user, account, trigger, session }) {
      try {
        // Si es un nuevo login, agregar datos del usuario al token
        if (user) {
          // Agregar timestamp de login para validar timeout
          token.loginTime = Date.now()
          
          // Para OAuth, obtener el usuario de la base de datos
          if (account?.provider === 'google' || account?.provider === 'azure-ad') {
            try {
              const dbUser = await prisma.users.findUnique({
                where: { email: user.email! },
                include: {
                  departments: true
                }
              })

              if (dbUser) {
                token.role = dbUser.role
                token.departmentId = dbUser.departmentId || undefined
                token.department = dbUser.departments?.name || undefined
                token.phone = dbUser.phone || undefined
                token.avatar = dbUser.avatar || user.image || undefined
                token.isOAuth = true
              } else {
                // Usuario no encontrado, usar valores por defecto
                token.role = 'CLIENT'
                token.isOAuth = true
              }
            } catch (error) {
              console.error('Error obteniendo usuario OAuth:', error)
              // Continuar con datos básicos
              token.role = 'CLIENT'
              token.isOAuth = true
            }
          } else {
            // Para credenciales
            token.role = user.role || 'CLIENT'
            token.departmentId = user.departmentId
            token.department = user.department
            token.phone = user.phone
            token.avatar = user.avatar
            token.isOAuth = false
          }
        }
        
        // Si es una actualización de sesión, mantener los datos
        if (trigger === 'update' && session) {
          token = { ...token, ...session }
        }
        
        return token
      } catch (error) {
        console.error('Error en JWT callback:', error)
        // Retornar token básico en caso de error
        return token
      }
    },

    async session({ session, token }) {
      try {
        if (token && session?.user) {
          session.user.id = token.sub!
          session.user.role = (token.role as UserRole) || 'CLIENT'
          session.user.departmentId = token.departmentId as string | undefined
          session.user.department = token.department as string | undefined
          session.user.phone = token.phone as string | undefined
          session.user.avatar = token.avatar as string | undefined
          session.user.isOAuth = (token.isOAuth as boolean) || false
          
          // IMPORTANTE: Pasar loginTime a la sesión para el monitor de timeout
          if (token.loginTime) {
            (session as any).loginTime = token.loginTime
          }
        }
        return session
      } catch (error) {
        console.error('Error en session callback:', error)
        // Retornar sesión básica en caso de error
        return session
      }
    },

    async redirect({ url, baseUrl }) {
      // Si viene de un callback URL específico, usarlo
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }
      
      // Si la URL contiene callbackUrl, extraerlo
      if (url.includes('callbackUrl=')) {
        const urlObj = new URL(url)
        const callbackUrl = urlObj.searchParams.get('callbackUrl')
        if (callbackUrl && callbackUrl.startsWith('/')) {
          return `${baseUrl}${callbackUrl}`
        }
      }
      
      // Si la URL es del mismo dominio, permitir
      if (new URL(url).origin === baseUrl) {
        return url
      }
      
      // Por defecto, redirigir a baseUrl
      return baseUrl
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
    newUser: '/client', // Redirigir nuevos usuarios OAuth al dashboard de cliente
  },
  // Configurar rutas públicas que no requieren autenticación
  // NextAuth no debe redirigir estas rutas
  secret: process.env.NEXTAUTH_SECRET,
  events: {
    async signIn({ user, account, isNewUser }) {
      // Registrar inicio de sesión en auditoría
      try {
        const { AuditServiceComplete } = await import('./services/audit-service-complete')
        
        await AuditServiceComplete.log({
          action: isNewUser ? 'user_registered' : 'login',
          entityType: 'user',
          entityId: user.id,
          userId: user.id,
          details: {
            provider: account?.provider || 'credentials',
            isNewUser: isNewUser || false,
            email: user.email,
            name: user.name,
            loginMethod: account?.type || 'credentials',
            timestamp: new Date().toISOString()
          },
          result: 'SUCCESS'
        })
        
        console.log(`[AUTH] Login registrado en auditoría: ${user.email}`)
      } catch (error) {
        console.error('[AUTH] Error registrando login en auditoría:', error)
        // No bloquear el login si falla la auditoría
      }
    },
    async signOut({ session, token }) {
      // Registrar cierre de sesión en auditoría
      try {
        const { AuditServiceComplete } = await import('./services/audit-service-complete')
        
        const userId = (session?.user?.id || token?.sub) as string
        
        if (userId) {
          await AuditServiceComplete.log({
            action: 'logout',
            entityType: 'user',
            entityId: userId,
            userId: userId,
            details: {
              timestamp: new Date().toISOString(),
              sessionDuration: session?.expires ? 
                Math.floor((new Date(session.expires).getTime() - Date.now()) / 1000) : 
                undefined
            },
            result: 'SUCCESS'
          })
          
          console.log(`[AUTH] Logout registrado en auditoría: ${userId}`)
        }
      } catch (error) {
        console.error('[AUTH] Error registrando logout en auditoría:', error)
        // No bloquear el logout si falla la auditoría
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}
