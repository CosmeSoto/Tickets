#!/usr/bin/env node

const Redis = require('ioredis')

async function testRedisConnection() {
  console.log('🔍 DIAGNÓSTICO DE CONEXIÓN REDIS')
  console.log('=' .repeat(50))
  
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380'
  console.log('🔗 URL de Redis:', redisUrl)
  
  try {
    console.log('\n1. CREANDO CLIENTE REDIS...')
    const redis = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 5000
    })
    
    // Eventos de conexión
    redis.on('connect', () => {
      console.log('✅ Redis conectado exitosamente')
    })
    
    redis.on('ready', () => {
      console.log('✅ Redis listo para recibir comandos')
    })
    
    redis.on('error', (error) => {
      console.error('❌ Error de Redis:', error.message)
    })
    
    redis.on('close', () => {
      console.log('🔌 Conexión Redis cerrada')
    })
    
    console.log('\n2. INTENTANDO CONECTAR...')
    await redis.connect()
    
    console.log('\n3. PROBANDO COMANDOS BÁSICOS...')
    
    // Test PING
    const pingResult = await redis.ping()
    console.log('📡 PING:', pingResult)
    
    // Test SET/GET
    const testKey = 'test:connection'
    const testValue = 'Hello Redis!'
    
    await redis.set(testKey, testValue)
    console.log('✅ SET exitoso')
    
    const getValue = await redis.get(testKey)
    console.log('📦 GET resultado:', getValue)
    
    // Test con TTL
    await redis.setex('test:ttl', 10, 'expires in 10 seconds')
    const ttl = await redis.ttl('test:ttl')
    console.log('⏰ TTL test:', ttl, 'segundos')
    
    // Limpiar
    await redis.del(testKey, 'test:ttl')
    console.log('🧹 Limpieza completada')
    
    // Info del servidor
    const info = await redis.info('server')
    const versionMatch = info.match(/redis_version:([^\r\n]+)/)
    if (versionMatch) {
      console.log('🏷️  Versión Redis:', versionMatch[1])
    }
    
    console.log('\n✅ TODAS LAS PRUEBAS EXITOSAS')
    
    await redis.disconnect()
    
  } catch (error) {
    console.error('\n❌ ERROR EN PRUEBA REDIS:', error.message)
    console.error('Stack:', error.stack)
    
    // Diagnósticos adicionales
    console.log('\n🔧 DIAGNÓSTICOS ADICIONALES:')
    console.log('- Verificar que Docker esté corriendo')
    console.log('- Verificar puerto 6380 disponible')
    console.log('- Verificar variable REDIS_URL')
    
    // Test de conectividad básica
    console.log('\n🧪 PROBANDO CONECTIVIDAD BÁSICA...')
    const net = require('net')
    const socket = new net.Socket()
    
    socket.setTimeout(3000)
    
    socket.on('connect', () => {
      console.log('✅ Puerto 6380 accesible')
      socket.destroy()
    })
    
    socket.on('timeout', () => {
      console.log('❌ Timeout conectando al puerto 6380')
      socket.destroy()
    })
    
    socket.on('error', (err) => {
      console.log('❌ Error de socket:', err.message)
    })
    
    socket.connect(6380, 'localhost')
  }
}

testRedisConnection()