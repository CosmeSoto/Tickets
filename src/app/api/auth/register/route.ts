import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// Schema de validación con Zod
const registerSchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo'),
  email: z.string()
    .email('Email inválido')
    .toLowerCase(),
  password: z.string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'La contraseña es demasiado larga'),
  phone: z.string()
    .optional()
    .nullable()
    .transform(val => val || null),
})

export async function POST(request: NextRequest) {
  try {
    // Parsear el body
    const body = await request.json()

    // Validar datos con Zod
    const validationResult = registerSchema.safeParse(body)
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path[0],
        message: err.message
      }))
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Datos inválidos',
          errors 
        },
        { status: 400 }
      )
    }

    const { name, email, password, phone } = validationResult.data

    // Verificar si el email ya existe
    const existingUser = await prisma.users.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Este email ya está registrado',
          field: 'email'
        },
        { status: 409 }
      )
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10)

    // Crear el usuario
    const user = await prisma.users.create({
      data: {
        id: randomUUID(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        phone: phone || null,
        role: 'CLIENT', // Siempre CLIENT para registro público
        isActive: true,
        isEmailVerified: false, // Puede implementarse verificación después
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      }
    })

    // Log de auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: user.id,
        userEmail: user.email,
        details: {
          name: user.name,
          email: user.email,
          role: user.role,
          registrationMethod: 'manual'
        },
        createdAt: new Date(),
      }
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Usuario registrado exitosamente',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error en registro:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al registrar usuario. Intenta de nuevo.' 
      },
      { status: 500 }
    )
  }
}
