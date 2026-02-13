import { UserRole } from '@prisma/client'
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      departmentId?: string
      department?: string
      phone?: string
      avatar?: string
      isOAuth?: boolean
    }
  }

  interface User {
    role: UserRole
    departmentId?: string
    department?: string
    phone?: string
    avatar?: string
    image?: string
    emailVerified?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    departmentId?: string
    department?: string
    phone?: string
    avatar?: string
    isOAuth?: boolean
  }
}
