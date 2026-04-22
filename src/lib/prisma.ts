/**
 * Re-exporta el singleton de Prisma desde @/lib/server
 * Mantiene compatibilidad con todos los imports existentes:
 *   import prisma from '@/lib/prisma'
 *   import { prisma } from '@/lib/prisma'
 */
export { db as default, db as prisma } from '@/lib/server'
