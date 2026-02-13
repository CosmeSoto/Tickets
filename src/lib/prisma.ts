import { PrismaClient } from '@prisma/client'

// Prevenir múltiples instancias de Prisma Client en desarrollo
declare global {
  var prisma: PrismaClient | undefined
}

// Crear o reutilizar la instancia de Prisma
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
  })
}

const prisma = global.prisma ?? prismaClientSingleton()

// En desarrollo, guardar la instancia globalmente para evitar múltiples conexiones
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

// Exportar por defecto
export default prisma
