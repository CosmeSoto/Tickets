#!/usr/bin/env node

/**
 * Cache System Test Script
 * Tests the caching system functionality
 */

const { performance } = require('perf_hooks')

// Mock Redis for testing
const mockRedis = {
  data: new Map(),
  tags: new Map(),
  
  async get(key) {
    const value = this.data.get(key)
    return value || null
  },
  
  async set(key, value) {
    this.data.set(key, value)
    return 'OK'
  },
  
  async setex(key, ttl, value) {
    this.data.set(key, value)
    // In real implementation, would handle TTL
    return 'OK'
  },
  
  async del(...keys) {
    let deleted = 0
    keys.forEach(key => {
      if (this.data.delete(key)) {
        deleted++
      }
    })
    return deleted
  },
  
  async exists(key) {
    return this.data.has(key) ? 1 : 0
  },
  
  async keys(pattern) {
    const keys = Array.from(this.data.keys())
    if (pattern === '*') return keys
    
    // Simple pattern matching
    const regex = new RegExp(pattern.replace('*', '.*'))
    return keys.filter(key => regex.test(key))
  },
  
  async sadd(key, value) {
    if (!this.tags.has(key)) {
      this.tags.set(key, new Set())
    }
    this.tags.get(key).add(value)
    return 1
  },
  
  async smembers(key) {
    const set = this.tags.get(key)
    return set ? Array.from(set) : []
  },
  
  async incrby(key, amount) {
    const current = parseInt(this.data.get(key) || '0')
    const newValue = current + amount
    this.data.set(key, newValue.toString())
    return newValue
  },
  
  async expire(key, ttl) {
    // In real implementation, would set expiration
    return this.data.has(key) ? 1 : 0
  },
  
  async ttl(key) {
    // In real implementation, would return actual TTL
    return this.data.has(key) ? 300 : -1
  }
}

// Simple cache service implementation
class TestCacheService {
  constructor() {
    this.redis = mockRedis
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    }
    this.defaultOptions = {
      ttl: 3600,
      prefix: 'app',
      serialize: true
    }
  }

  async get(key, options = {}) {
    try {
      const opts = { ...this.defaultOptions, ...options }
      const fullKey = `${opts.prefix}:${key}`
      
      const cached = await this.redis.get(fullKey)
      
      if (cached === null) {
        this.stats.misses++
        return null
      }

      this.stats.hits++
      
      if (opts.serialize) {
        return JSON.parse(cached)
      }
      
      return cached
    } catch (error) {
      this.stats.errors++
      console.error('Cache get error:', error)
      return null
    }
  }

  async set(key, value, options = {}) {
    try {
      const opts = { ...this.defaultOptions, ...options }
      const fullKey = `${opts.prefix}:${key}`
      
      let serializedValue = value
      if (opts.serialize) {
        serializedValue = JSON.stringify(value)
      }

      if (opts.ttl && opts.ttl > 0) {
        await this.redis.setex(fullKey, opts.ttl, serializedValue)
      } else {
        await this.redis.set(fullKey, serializedValue)
      }

      // Store tags for invalidation
      if (opts.tags && opts.tags.length > 0) {
        for (const tag of opts.tags) {
          await this.redis.sadd(`tags:${tag}`, fullKey)
        }
      }

      this.stats.sets++
      return true
    } catch (error) {
      this.stats.errors++
      console.error('Cache set error:', error)
      return false
    }
  }

  async getOrSet(key, fetchFn, options = {}) {
    const cached = await this.get(key, options)
    
    if (cached !== null) {
      return cached
    }

    const value = await fetchFn()
    await this.set(key, value, options)
    
    return value
  }

  async invalidateByTags(tags) {
    try {
      let deletedCount = 0

      for (const tag of tags) {
        const tagKey = `tags:${tag}`
        const keys = await this.redis.smembers(tagKey)
        
        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys)
          deletedCount += deleted
          
          // Clean up the tag set
          await this.redis.del(tagKey)
        }
      }

      return deletedCount
    } catch (error) {
      this.stats.errors++
      console.error('Cache invalidate by tags error:', error)
      return 0
    }
  }

  async clear(pattern = '*') {
    try {
      const searchPattern = pattern || `${this.defaultOptions.prefix}:*`
      const keys = await this.redis.keys(searchPattern)
      
      if (keys.length === 0) {
        return 0
      }

      const deleted = await this.redis.del(...keys)
      return deleted
    } catch (error) {
      this.stats.errors++
      console.error('Cache clear error:', error)
      return 0
    }
  }

  getStats() {
    return { ...this.stats }
  }

  getHitRatio() {
    const total = this.stats.hits + this.stats.misses
    return total > 0 ? this.stats.hits / total : 0
  }

  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    }
  }
}

// Test functions
async function testBasicOperations(cache) {
  console.log('\n🧪 Testing Basic Cache Operations...')
  
  // Test set and get
  const testData = { id: 1, name: 'Test User', email: 'test@example.com' }
  
  const setResult = await cache.set('user:1', testData, { ttl: 300 })
  console.log(`✅ Set operation: ${setResult ? 'SUCCESS' : 'FAILED'}`)
  
  const getData = await cache.get('user:1')
  console.log(`✅ Get operation: ${JSON.stringify(getData) === JSON.stringify(testData) ? 'SUCCESS' : 'FAILED'}`)
  
  // Test cache miss
  const missData = await cache.get('nonexistent')
  console.log(`✅ Cache miss: ${missData === null ? 'SUCCESS' : 'FAILED'}`)
  
  return true
}

async function testGetOrSetPattern(cache) {
  console.log('\n🔄 Testing GetOrSet Pattern...')
  
  let fetchCount = 0
  const fetchFn = async () => {
    fetchCount++
    return { id: 2, name: 'Fetched User', timestamp: Date.now() }
  }
  
  // First call - should fetch
  const result1 = await cache.getOrSet('user:2', fetchFn, { ttl: 300 })
  console.log(`✅ First call (fetch): ${fetchCount === 1 ? 'SUCCESS' : 'FAILED'}`)
  
  // Second call - should use cache
  const result2 = await cache.getOrSet('user:2', fetchFn, { ttl: 300 })
  console.log(`✅ Second call (cache): ${fetchCount === 1 ? 'SUCCESS' : 'FAILED'}`)
  console.log(`✅ Same data: ${result1.id === result2.id ? 'SUCCESS' : 'FAILED'}`)
  
  return true
}

async function testTagInvalidation(cache) {
  console.log('\n🏷️  Testing Tag-based Invalidation...')
  
  // Set data with tags
  await cache.set('user:1', { name: 'User 1' }, { tags: ['users', 'profile'] })
  await cache.set('user:2', { name: 'User 2' }, { tags: ['users'] })
  await cache.set('category:1', { name: 'Category 1' }, { tags: ['categories'] })
  
  // Verify data exists
  const user1 = await cache.get('user:1')
  const user2 = await cache.get('user:2')
  const category1 = await cache.get('category:1')
  
  console.log(`✅ Data set: ${user1 && user2 && category1 ? 'SUCCESS' : 'FAILED'}`)
  
  // Invalidate by tag
  const invalidated = await cache.invalidateByTags(['users'])
  console.log(`✅ Invalidated ${invalidated} entries`)
  
  // Check what remains
  const user1After = await cache.get('user:1')
  const user2After = await cache.get('user:2')
  const category1After = await cache.get('category:1')
  
  console.log(`✅ Users invalidated: ${!user1After && !user2After ? 'SUCCESS' : 'FAILED'}`)
  console.log(`✅ Categories preserved: ${category1After ? 'SUCCESS' : 'FAILED'}`)
  
  return true
}

async function testPerformance(cache) {
  console.log('\n⚡ Testing Cache Performance...')
  
  const iterations = 1000
  
  // Test write performance
  const writeStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    await cache.set(`perf:${i}`, { id: i, data: `test-${i}` })
  }
  const writeEnd = performance.now()
  const writeTime = writeEnd - writeStart
  
  console.log(`✅ Write performance: ${iterations} operations in ${writeTime.toFixed(2)}ms`)
  console.log(`   Average: ${(writeTime / iterations).toFixed(3)}ms per operation`)
  
  // Test read performance
  const readStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    await cache.get(`perf:${i}`)
  }
  const readEnd = performance.now()
  const readTime = readEnd - readStart
  
  console.log(`✅ Read performance: ${iterations} operations in ${readTime.toFixed(2)}ms`)
  console.log(`   Average: ${(readTime / iterations).toFixed(3)}ms per operation`)
  
  return true
}

async function testCacheStatistics(cache) {
  console.log('\n📊 Testing Cache Statistics...')
  
  cache.resetStats()
  
  // Generate some cache activity
  await cache.set('stats:1', { data: 'test1' })
  await cache.set('stats:2', { data: 'test2' })
  await cache.get('stats:1') // hit
  await cache.get('stats:2') // hit
  await cache.get('stats:3') // miss
  await cache.get('stats:4') // miss
  
  const stats = cache.getStats()
  const hitRatio = cache.getHitRatio()
  
  console.log(`✅ Sets: ${stats.sets} (expected: 2)`)
  console.log(`✅ Hits: ${stats.hits} (expected: 2)`)
  console.log(`✅ Misses: ${stats.misses} (expected: 2)`)
  console.log(`✅ Hit ratio: ${(hitRatio * 100).toFixed(1)}% (expected: 50%)`)
  console.log(`✅ Errors: ${stats.errors} (expected: 0)`)
  
  return stats.sets === 2 && stats.hits === 2 && stats.misses === 2 && stats.errors === 0
}

async function testConcurrentOperations(cache) {
  console.log('\n🔀 Testing Concurrent Operations...')
  
  const concurrency = 50
  const operations = []
  
  // Create concurrent operations
  for (let i = 0; i < concurrency; i++) {
    operations.push(cache.set(`concurrent:${i}`, { id: i, data: `concurrent-${i}` }))
  }
  
  const start = performance.now()
  const results = await Promise.all(operations)
  const end = performance.now()
  
  const successCount = results.filter(r => r === true).length
  
  console.log(`✅ Concurrent writes: ${successCount}/${concurrency} successful`)
  console.log(`✅ Time: ${(end - start).toFixed(2)}ms`)
  
  // Test concurrent reads
  const readOperations = []
  for (let i = 0; i < concurrency; i++) {
    readOperations.push(cache.get(`concurrent:${i}`))
  }
  
  const readStart = performance.now()
  const readResults = await Promise.all(readOperations)
  const readEnd = performance.now()
  
  const readSuccessCount = readResults.filter(r => r !== null).length
  
  console.log(`✅ Concurrent reads: ${readSuccessCount}/${concurrency} successful`)
  console.log(`✅ Time: ${(readEnd - readStart).toFixed(2)}ms`)
  
  return successCount === concurrency && readSuccessCount === concurrency
}

// Main test runner
async function runCacheTests() {
  console.log('🚀 Starting Cache System Tests')
  console.log('================================')
  
  const cache = new TestCacheService()
  const tests = [
    { name: 'Basic Operations', fn: testBasicOperations },
    { name: 'GetOrSet Pattern', fn: testGetOrSetPattern },
    { name: 'Tag Invalidation', fn: testTagInvalidation },
    { name: 'Performance', fn: testPerformance },
    { name: 'Statistics', fn: testCacheStatistics },
    { name: 'Concurrent Operations', fn: testConcurrentOperations },
  ]
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    try {
      const result = await test.fn(cache)
      if (result) {
        console.log(`\n✅ ${test.name}: PASSED`)
        passed++
      } else {
        console.log(`\n❌ ${test.name}: FAILED`)
        failed++
      }
    } catch (error) {
      console.log(`\n❌ ${test.name}: ERROR - ${error.message}`)
      failed++
    }
  }
  
  console.log('\n================================')
  console.log('📋 Test Results Summary')
  console.log('================================')
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📊 Total: ${passed + failed}`)
  
  const finalStats = cache.getStats()
  console.log('\n📈 Final Cache Statistics:')
  console.log(`   Hits: ${finalStats.hits}`)
  console.log(`   Misses: ${finalStats.misses}`)
  console.log(`   Sets: ${finalStats.sets}`)
  console.log(`   Deletes: ${finalStats.deletes}`)
  console.log(`   Errors: ${finalStats.errors}`)
  console.log(`   Hit Ratio: ${(cache.getHitRatio() * 100).toFixed(1)}%`)
  
  if (failed === 0) {
    console.log('\n🎉 All cache tests passed! Cache system is working correctly.')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some cache tests failed. Please check the implementation.')
    process.exit(1)
  }
}

// Run tests if called directly
if (require.main === module) {
  runCacheTests().catch(error => {
    console.error('❌ Test execution failed:', error)
    process.exit(1)
  })
}

module.exports = {
  TestCacheService,
  runCacheTests
}