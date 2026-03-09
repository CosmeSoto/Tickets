import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { SecurityConfigService } from '@/lib/services/security-config-service'

export async function POST(request: NextRequest) {
  try {
    // Obtener configuración de seguridad
    const securityConfig = await SecurityConfigService.getConfig()

    // Schema de validación con Zod (dinámico según configuración)
    const registerSchema = z.object({
      name: z.string()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(100, 'El nombre es demasiado largo'),
      email: z.string()
        .email('Email inválido')
        .toLowerCase(),
      password: z.string()
        .min(securityConfig.passwordMinLength, `La contraseña debe tener al menos ${securityConfig.passwordMinLength} caracteres`)
        .max(100, 'La contraseña es demasiado larga'),
      phone: z.string()
        .optional()
        .nullable()
        .transform(val => val || null),
      departmentId: z.string()
        .optional()
        .nullable()
        .transform(val => val || null),
    })

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

    const { name, email, password, phone, departmentId } = validationResult.data

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

    // Si se proporciona departmentId, verificar que existe
    if (departmentId) {
      const department = await prisma.departments.findUnique({
        where: { id: departmentId }
      })

      if (!department) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'El departamento seleccionado no existe',
            field: 'departmentId'
          },
          { status: 400 }
        )
      }
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
        departmentId: departmentId || null,
        role: 'CLIENT',
        isActive: true,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
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
          departmentId: user.departmentId,
          registrationMethod: 'self_register'
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
          departmentId: user.departmentId,
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
