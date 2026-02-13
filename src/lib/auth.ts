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
          const user = await prisma.users.findUnique({
            where: {
              email: credentials.email,
            },
            include: {
              departments: true
            }
          })

          if (!user || !user.passwordHash) {
            throw new Error('Credenciales inválidas')
          }

          if (!user.isActive) {
            throw new Error('Usuario desactivado')
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash)

          if (!isPasswordValid) {
            throw new Error('Credenciales inválidas')
          }

          // Actualizar último login
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
    maxAge: 24 * 60 * 60, // 24 horas
    updateAge: 24 * 60 * 60, // Actualizar cada 24 horas
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 horas
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

              // Crear preferencias por defecto
              await prisma.user_preferences.create({
                data: {
                  id: randomUUID(),
                  userId: newUser.id,
                  theme: 'system',
                  timezone: 'America/Guayaquil',
                  language: 'es',
                  createdAt: new Date(),
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
  events: {
    async signIn({ user, account, isNewUser }) {
      // Evento silencioso - solo para tracking interno si es necesario
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}
