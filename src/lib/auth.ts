import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import prisma from './prisma'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import { getCachedOAuthProviders, invalidateOAuthProvidersCache } from './auth/load-oauth-providers'
import { LOCKOUT_DURATION_MINUTES } from './services/security-config-service'
import { clientNeedsProfileCompletion } from './auth/profile-completion'

export { invalidateOAuthProvidersCache }

const credentialsProvider = CredentialsProvider({
  name: 'credentials',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Contraseña', type: 'password' },
  },
  async authorize(credentials, req) {
    if (!credentials?.email || !credentials?.password) {
      throw new Error('Email y contraseña son requeridos')
    }

    try {
      // NUEVO: Verificar si la cuenta está bloqueada por intentos fallidos
      const { SecurityConfigService } = await import('./services/security-config-service')

      // Extraer IP real del request (soporta proxies y load balancers)
      const ipAddress =
        (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (req?.headers?.['x-real-ip'] as string) ||
        'unknown'

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
              timestamp: new Date().toISOString(),
            },
            result: 'ERROR',
            errorCode: 'AUTH_ACCOUNT_LOCKED',
            errorMessage: 'Cuenta bloqueada por múltiples intentos fallidos',
          })
        } catch (auditError) {
          console.error('[AUTH] Error registrando intento bloqueado:', auditError)
        }

        throw new Error(
          `Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo en ${LOCKOUT_DURATION_MINUTES} minutos.`
        )
      }

      const user = await prisma.users.findUnique({
        where: {
          email: credentials.email,
        },
        include: {
          departments: true,
        },
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
              timestamp: new Date().toISOString(),
            },
            result: 'ERROR',
            errorCode: 'AUTH_ACCOUNT_DISABLED',
            errorMessage: 'Intento de acceso a cuenta desactivada',
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
        const updatedLockStatus = await SecurityConfigService.isAccountLocked(
          credentials.email,
          ipAddress
        )

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
              timestamp: new Date().toISOString(),
            },
            result: 'ERROR',
            errorCode: 'AUTH_INVALID_PASSWORD',
            errorMessage: 'Contraseña incorrecta',
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
})

const sharedAuthOptions: Omit<NextAuthOptions, 'providers'> = {
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
          if (!user.email?.trim()) {
            console.error('[AUTH] OAuth rechazado: cuenta sin email')
            return false
          }

          try {
            // Buscar si el usuario ya existe
            const existingUser = await prisma.users.findUnique({
              where: { email: user.email! },
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
                },
              })

              // Verificar si está activo
              if (!existingUser.isActive) {
                return false
              }

              return true
            } else {
              // Usuario nuevo: se crea sin departamento/teléfono;
              // el middleware redirige a /complete-profile tras el login OAuth.
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
                },
              })

              // Crear configuración por defecto (user_settings unificado)
              await prisma.user_settings.upsert({
                where: { userId: newUser.id },
                update: {},
                create: {
                  id: randomUUID(),
                  userId: newUser.id,
                  theme: 'light',
                  timezone: DEFAULT_TIMEZONE,
                  language: 'es',
                  updatedAt: new Date(),
                },
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
                },
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
          // Timestamps para timeout por inactividad (Admin → Seguridad)
          token.loginTime = Date.now()
          token.lastActivityAt = Date.now()

          // Para OAuth, obtener el usuario de la base de datos
          if (account?.provider === 'google' || account?.provider === 'azure-ad') {
            try {
              const dbUser = await prisma.users.findUnique({
                where: { email: user.email! },
                include: { departments: true },
              })

              if (dbUser) {
                token.sub = dbUser.id
                token.role = dbUser.role
                token.departmentId = dbUser.departmentId || undefined
                token.department = dbUser.departments?.name || undefined
                token.phone = dbUser.phone || undefined
                token.avatar = dbUser.avatar || user.image || undefined
                token.canManageInventory = dbUser.canManageInventory ?? false
                token.isSuperAdmin = (dbUser as any).isSuperAdmin ?? false
                token.ticketsEnabled = dbUser.ticketsEnabled ?? true
                token.inventoryEnabled = dbUser.inventoryEnabled ?? true
                token.canRequestAssets = dbUser.canRequestAssets ?? false
                token.canAccessKnowledge = (dbUser as any).canAccessKnowledge ?? true
                token.patrolsEnabled = dbUser.patrolsEnabled ?? false
                token.newsEnabled = dbUser.newsEnabled ?? false
                token.canManageNews = dbUser.canManageNews ?? false
                token.formsEnabled = dbUser.formsEnabled ?? false
                token.canManageForms = dbUser.canManageForms ?? false
                token.credentialsEnabled = dbUser.credentialsEnabled ?? false
                token.canManageCredentials = dbUser.canManageCredentials ?? false
                token.isOAuth = true
                token.needsProfileCompletion = clientNeedsProfileCompletion({
                  role: dbUser.role,
                  departmentId: dbUser.departmentId,
                  phone: dbUser.phone,
                })
              } else {
                token.role = 'CLIENT'
                token.isOAuth = true
                token.patrolsEnabled = false
                token.canManageInventory = false
                token.canRequestAssets = false
                token.canAccessKnowledge = true
                token.newsEnabled = false
                token.canManageNews = false
                token.formsEnabled = false
                token.canManageForms = false
                token.credentialsEnabled = false
                token.canManageCredentials = false
              }
            } catch (error) {
              console.error('Error obteniendo usuario OAuth:', error)
              token.role = 'CLIENT'
              token.isOAuth = true
            }
          } else {
            // Para credenciales — leer canManageInventory de la BD
            token.role = user.role || 'CLIENT'
            token.departmentId = user.departmentId
            token.department = user.department
            token.phone = user.phone
            token.avatar = user.avatar
            token.isOAuth = false
            token.needsProfileCompletion = clientNeedsProfileCompletion({
              role: user.role || 'CLIENT',
              departmentId: user.departmentId,
              phone: user.phone,
            })
            try {
              const dbUser = await prisma.users.findUnique({
                where: { id: user.id },
                select: {
                  canManageInventory: true,
                  isSuperAdmin: true,
                  ticketsEnabled: true,
                  inventoryEnabled: true,
                  canRequestAssets: true,
                  canAccessKnowledge: true,
                  patrolsEnabled: true,
                  newsEnabled: true,
                  canManageNews: true,
                  formsEnabled: true,
                  canManageForms: true,
                  credentialsEnabled: true,
                  canManageCredentials: true,
                  passwordChangedAt: true,
                },
              })
              token.canManageInventory = dbUser?.canManageInventory ?? false
              token.isSuperAdmin = dbUser?.isSuperAdmin ?? false
              token.ticketsEnabled = dbUser?.ticketsEnabled ?? true
              token.inventoryEnabled = dbUser?.inventoryEnabled ?? true
              token.canRequestAssets = dbUser?.canRequestAssets ?? false
              token.canAccessKnowledge = (dbUser as any)?.canAccessKnowledge ?? true
              token.patrolsEnabled = dbUser?.patrolsEnabled ?? false
              token.newsEnabled = dbUser?.newsEnabled ?? false
              token.canManageNews = dbUser?.canManageNews ?? false
              token.formsEnabled = dbUser?.formsEnabled ?? false
              token.canManageForms = dbUser?.canManageForms ?? false
              token.credentialsEnabled = dbUser?.credentialsEnabled ?? false
              token.canManageCredentials = dbUser?.canManageCredentials ?? false

              // ── Política de cambio de contraseña ───────────────────────
              try {
                const isOAuthUser = Boolean(token.isOAuth)
                if (isOAuthUser) {
                  token.mustChangePassword = false
                } else {
                  const { SecurityConfigService } =
                    await import('./services/security-config-service')
                  const secCfg = await SecurityConfigService.getConfig()

                  if (secCfg.requirePasswordChange) {
                    const passwordChangedAt = dbUser?.passwordChangedAt ?? null
                    let mustChange = false

                    if (!passwordChangedAt) {
                      // Nunca cambió / forzado por admin → exigir cambio
                      mustChange = true
                    } else if (secCfg.passwordChangeIntervalDays > 0) {
                      const expiresAt = new Date(passwordChangedAt)
                      expiresAt.setDate(expiresAt.getDate() + secCfg.passwordChangeIntervalDays)
                      mustChange = Date.now() > expiresAt.getTime()
                    }

                    token.mustChangePassword = mustChange
                  } else {
                    token.mustChangePassword = false
                  }
                }
              } catch {
                token.mustChangePassword = false
              }
              // ─────────────────────────────────────────────────────────────
            } catch {
              token.canManageInventory = false
              token.isSuperAdmin = false
              token.ticketsEnabled = true
              token.inventoryEnabled = true
              token.canRequestAssets = true // Prisma default = true
              token.canAccessKnowledge = true
              token.patrolsEnabled = false
              token.newsEnabled = false
              token.canManageNews = false
              token.credentialsEnabled = false
              token.canManageCredentials = false
              token.mustChangePassword = false
            }
          }
        }

        // Refrescar rol y permisos desde la BD — cacheado 2 min por usuario
        // Garantiza que cambios de rol/permisos se reflejen sin cerrar sesión
        if (!user && token.sub) {
          try {
            const { withCache } = await import('@/lib/api-cache')
            const dbUser = await withCache(`auth:user:${token.sub}`, 120, () =>
              prisma.users.findUnique({
                where: { id: token.sub! },
                select: {
                  role: true,
                  isActive: true,
                  canManageInventory: true,
                  isSuperAdmin: true,
                  ticketsEnabled: true,
                  inventoryEnabled: true,
                  canRequestAssets: true,
                  canAccessKnowledge: true,
                  patrolsEnabled: true,
                  newsEnabled: true,
                  canManageNews: true,
                  formsEnabled: true,
                  canManageForms: true,
                  credentialsEnabled: true,
                  canManageCredentials: true,
                  departmentId: true,
                  phone: true,
                  passwordChangedAt: true,
                  passwordHash: true,
                  oauthProvider: true,
                  departments: { select: { name: true } },
                },
              })
            )
            if (dbUser) {
              if (!dbUser.isActive) {
                return { ...token, error: 'UserDeactivated' }
              }
              token.role = dbUser.role
              token.canManageInventory = dbUser.canManageInventory ?? false
              token.isSuperAdmin = (dbUser as any).isSuperAdmin ?? false
              token.ticketsEnabled = dbUser.ticketsEnabled ?? true
              token.inventoryEnabled = dbUser.inventoryEnabled ?? true
              token.canRequestAssets = dbUser.canRequestAssets ?? false
              token.canAccessKnowledge = (dbUser as any).canAccessKnowledge ?? true
              token.patrolsEnabled = dbUser.patrolsEnabled ?? false
              token.newsEnabled = dbUser.newsEnabled ?? false
              token.canManageNews = (dbUser as any).canManageNews ?? false
              token.formsEnabled = dbUser.formsEnabled ?? false
              token.canManageForms = dbUser.canManageForms ?? false
              token.credentialsEnabled = dbUser.credentialsEnabled ?? false
              token.canManageCredentials = dbUser.canManageCredentials ?? false
              token.departmentId = dbUser.departmentId || undefined
              token.department = dbUser.departments?.name || undefined
              token.phone = dbUser.phone || undefined
              token.needsProfileCompletion = clientNeedsProfileCompletion({
                role: dbUser.role,
                departmentId: dbUser.departmentId,
                phone: dbUser.phone,
              })

              // Re-evaluar política de contraseña en refrescos (caducidad por días)
              try {
                const isOAuthUser = Boolean(dbUser.oauthProvider) && !dbUser.passwordHash
                if (isOAuthUser) {
                  token.mustChangePassword = false
                } else {
                  const { SecurityConfigService } =
                    await import('./services/security-config-service')
                  const secCfg = await SecurityConfigService.getConfig()
                  if (!secCfg.requirePasswordChange) {
                    token.mustChangePassword = false
                  } else if (!dbUser.passwordChangedAt) {
                    token.mustChangePassword = true
                  } else if (secCfg.passwordChangeIntervalDays > 0) {
                    const expiresAt = new Date(dbUser.passwordChangedAt)
                    expiresAt.setDate(expiresAt.getDate() + secCfg.passwordChangeIntervalDays)
                    token.mustChangePassword = Date.now() > expiresAt.getTime()
                  } else {
                    token.mustChangePassword = false
                  }
                }
              } catch {
                // Mantener valor previo del token
              }
            } else {
              return { ...token, error: 'UserDeleted' }
            }
          } catch {
            // Si falla la BD, continuar con el token existente
          }
        }

        // Si es una actualización de sesión explícita, aplicar los datos
        if (trigger === 'update' && session) {
          token = { ...token, ...session }
          if (typeof (session as { lastActivityAt?: number }).lastActivityAt === 'number') {
            token.lastActivityAt = (session as { lastActivityAt: number }).lastActivityAt
          }
          if (
            typeof (session as { mustChangePassword?: boolean }).mustChangePassword === 'boolean'
          ) {
            token.mustChangePassword = (
              session as { mustChangePassword: boolean }
            ).mustChangePassword
          }
          if (
            typeof (session as { needsProfileCompletion?: boolean }).needsProfileCompletion ===
            'boolean'
          ) {
            token.needsProfileCompletion = (
              session as { needsProfileCompletion: boolean }
            ).needsProfileCompletion
          }
          if (typeof (session as { departmentId?: string }).departmentId === 'string') {
            token.departmentId = (session as { departmentId: string }).departmentId
          }
          if (typeof (session as { department?: string }).department === 'string') {
            token.department = (session as { department: string }).department
          }
          if (typeof (session as { phone?: string }).phone === 'string') {
            token.phone = (session as { phone: string }).phone
          }
        }

        // Timeout por inactividad según system_settings.sessionTimeout
        try {
          const { SecurityConfigService } = await import('./services/security-config-service')
          const secCfg = await SecurityConfigService.getConfig()
          const timeoutMs = secCfg.sessionTimeout * 60 * 1000
          const lastActivity =
            typeof token.lastActivityAt === 'number'
              ? token.lastActivityAt
              : typeof token.loginTime === 'number'
                ? token.loginTime
                : null

          if (lastActivity !== null && Date.now() - lastActivity > timeoutMs) {
            return { ...token, error: 'SessionExpired' }
          }
        } catch {
          // Si falla la lectura de config, mantener sesión
        }

        return token
      } catch (error) {
        console.error('Error en JWT callback:', error)
        return token
      }
    },

    async session({ session, token }) {
      try {
        if (token && session?.user) {
          // Si el usuario fue desactivado, retornar sesión sin datos para forzar logout
          if ((token as any).error === 'UserDeactivated') {
            return { ...session, user: { ...session.user }, error: 'UserDeactivated' } as any
          }
          if ((token as any).error === 'UserDeleted') {
            return { ...session, expires: new Date(0).toISOString(), error: 'UserDeleted' } as any
          }
          if ((token as any).error === 'SessionExpired') {
            return {
              ...session,
              expires: new Date(0).toISOString(),
              error: 'SessionExpired',
            } as any
          }

          session.user.id = token.sub!
          session.user.role = (token.role as UserRole) || 'CLIENT'
          session.user.departmentId = token.departmentId as string | undefined
          session.user.department = token.department as string | undefined
          session.user.phone = token.phone as string | undefined
          session.user.avatar = token.avatar as string | undefined
          session.user.isOAuth = (token.isOAuth as boolean) || false
          ;(session.user as any).canManageInventory = (token.canManageInventory as boolean) || false
          ;(session.user as any).isSuperAdmin = (token.isSuperAdmin as boolean) || false

          // Agregar ticketsEnabled e inventoryEnabled desde el token
          ;(session.user as any).ticketsEnabled = (token.ticketsEnabled as boolean) ?? true
          ;(session.user as any).inventoryEnabled = (token.inventoryEnabled as boolean) ?? true
          ;(session.user as any).canRequestAssets = (token.canRequestAssets as boolean) ?? false
          ;(session.user as any).canAccessKnowledge = (token.canAccessKnowledge as boolean) ?? true
          session.user.patrolsEnabled = (token.patrolsEnabled as boolean) ?? false
          ;(session.user as any).newsEnabled = (token.newsEnabled as boolean) ?? false
          ;(session.user as any).canManageNews = (token.canManageNews as boolean) ?? false
          ;(session.user as any).formsEnabled = (token.formsEnabled as boolean) ?? false
          ;(session.user as any).canManageForms = (token.canManageForms as boolean) ?? false
          ;(session.user as any).credentialsEnabled = (token.credentialsEnabled as boolean) ?? false
          ;(session.user as any).canManageCredentials =
            (token.canManageCredentials as boolean) ?? false

          // Política de cambio de contraseña
          ;(session.user as any).mustChangePassword = (token.mustChangePassword as boolean) ?? false
          ;(session.user as any).needsProfileCompletion =
            (token.needsProfileCompletion as boolean) ?? false

          // IMPORTANTE: Pasar loginTime a la sesión para el monitor de timeout
          if (token.loginTime) {
            ;(session as any).loginTime = token.loginTime
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
      // NextAuth requiere URLs absolutas como retorno.
      // Usamos baseUrl (NEXTAUTH_URL) para construir la URL absoluta.
      // El navegador seguirá el redirect sin importar el hostname.

      // Si es una URL relativa, construir absoluta con baseUrl
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }

      // Si la URL contiene callbackUrl, extraerlo
      if (url.includes('callbackUrl=')) {
        try {
          const urlObj = new URL(url)
          const callbackUrl = urlObj.searchParams.get('callbackUrl')
          if (callbackUrl && callbackUrl.startsWith('/')) {
            return `${baseUrl}${callbackUrl}`
          }
        } catch {
          // Si falla el parse, continuar con el flujo normal
        }
      }

      // Si la URL es del mismo dominio, permitir
      try {
        if (new URL(url).origin === baseUrl) {
          return url
        }
      } catch {
        // URL inválida
      }

      // Por defecto, redirigir al baseUrl
      return baseUrl
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
    newUser: '/complete-profile',
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      // Registrar inicio de sesión en auditoría
      try {
        const { AuditServiceComplete } = await import('./services/audit-service-complete')

        const dbUser = user.email
          ? await prisma.users.findUnique({
              where: { email: user.email },
              select: { id: true },
            })
          : null
        const auditUserId = dbUser?.id ?? user.id

        await AuditServiceComplete.log({
          action: isNewUser ? 'user_registered' : 'login',
          entityType: 'user',
          entityId: auditUserId,
          userId: auditUserId,
          details: {
            provider: account?.provider || 'credentials',
            isNewUser: isNewUser || false,
            email: user.email,
            name: user.name,
            loginMethod: account?.type || 'credentials',
            timestamp: new Date().toISOString(),
          },
          result: 'SUCCESS',
        })
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
          // Verificar que el usuario existe antes de crear el log (evita FK violation)
          const { default: prismaClient } = await import('@/lib/prisma')
          const userExists = await prismaClient.users.findUnique({
            where: { id: userId },
            select: { id: true },
          })

          if (userExists) {
            await AuditServiceComplete.log({
              action: 'logout',
              entityType: 'user',
              entityId: userId,
              userId: userId,
              details: {
                timestamp: new Date().toISOString(),
                sessionDuration: session?.expires
                  ? Math.floor((new Date(session.expires).getTime() - Date.now()) / 1000)
                  : undefined,
              },
              result: 'SUCCESS',
            })
          }
        }
      } catch (error) {
        console.error('[AUTH] Error registrando logout en auditoría:', error)
        // No bloquear el logout si falla la auditoría
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  /** Evita ruido en consola; activar solo al depurar flujos de auth (`NEXTAUTH_DEBUG=true`). */
  debug: process.env.NEXTAUTH_DEBUG === 'true',
}

/** Opciones estáticas (solo credentials) — válidas para getServerSession. */
export const authOptions: NextAuthOptions = {
  ...sharedAuthOptions,
  providers: [credentialsProvider],
}

/** Opciones completas con OAuth desde BD (usar en /api/auth/[...nextauth]). */
export async function getAuthOptions(): Promise<NextAuthOptions> {
  const oauthProviders = await getCachedOAuthProviders()
  const { SecurityConfigService } = await import('./services/security-config-service')
  const config = await SecurityConfigService.getConfig()
  const maxAge = config.sessionTimeout * 60

  return {
    ...sharedAuthOptions,
    session: {
      ...sharedAuthOptions.session,
      maxAge,
      updateAge: Math.min(3600, maxAge),
    },
    jwt: {
      ...sharedAuthOptions.jwt,
      maxAge,
    },
    providers: [credentialsProvider, ...oauthProviders],
  }
}
