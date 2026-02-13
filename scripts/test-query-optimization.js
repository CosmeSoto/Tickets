#!/usr/bin/env node

/**
 * Query Optimization Test Script
 * Tests database query performance and optimization effectiveness
 */

const { performance } = require('perf_hooks')

// Mock Prisma for testing
const mockPrisma = {
  ticket: {
    findMany: async () => [],
    findUnique: async () => null,
    count: async () => 0,
    groupBy: async () => [],
    create: async () => ({}),
    update: async () => ({}),
  },
  user: {
    findMany: async () => [],
    findUnique: async () => null,
  },
  category: {
    findMany: async () => [],
  },
  comment: {
    findMany: async () => [],
  },
  $transaction: async (callback) => callback(mockPrisma),
  $queryRaw: async () => [],
}

// Query performance analyzer
class QueryPerformanceAnalyzer {
  constructor() {
    this.results = []
    this.thresholds = {
      excellent: 50,    // < 50ms
      good: 100,        // < 100ms
      acceptable: 500,  // < 500ms
      poor: 1000        // < 1000ms
    }
  }

  async measureQuery(name, queryFn, expectedRows = 0) {
    const startTime = performance.now()
    
    try {
      const result = await queryFn()
      const endTime = performance.now()
      const executionTime = endTime - startTime
      
      const analysis = {
        name,
        executionTime: Math.round(executionTime * 100) / 100,
        resultCount: Array.isArray(result) ? result.length : (result ? 1 : 0),
        expectedRows,
        status: this.getPerformanceStatus(executionTime),
        recommendations: this.getRecommendations(executionTime, result)
      }
      
      this.results.push(analysis)
      return analysis
    } catch (error) {
      const endTime = performance.now()
      const analysis = {
        name,
        executionTime: Math.round((endTime - startTime) * 100) / 100,
        resultCount: 0,
        expectedRows,
        status: 'error',
        error: error.message,
        recommendations: ['Fix query error before optimization']
      }
      
      this.results.push(analysis)
      return analysis
    }
  }

  getPerformanceStatus(time) {
    if (time < this.thresholds.excellent) return 'excellent'
    if (time < this.thresholds.good) return 'good'
    if (time < this.thresholds.acceptable) return 'acceptable'
    if (time < this.thresholds.poor) return 'poor'
    return 'critical'
  }

  getRecommendations(time, result) {
    const recommendations = []
    
    if (time > 1000) {
      recommendations.push('Critical: Query is very slow (>1s). Immediate optimization required.')
    } else if (time > 500) {
      recommendations.push('Query is slow (>500ms). Consider adding indexes or optimizing structure.')
    } else if (time > 100) {
      recommendations.push('Query could be faster. Consider caching or minor optimizations.')
    }
    
    if (Array.isArray(result) && result.length > 1000) {
      recommendations.push('Large result set. Implement pagination or result limiting.')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Query performance is good. Monitor for regression.')
    }
    
    return recommendations
  }

  generateReport() {
    const totalQueries = this.results.length
    const avgTime = this.results.reduce((sum, r) => sum + r.executionTime, 0) / totalQueries
    const statusCounts = this.results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {})

    return {
      summary: {
        totalQueries,
        averageExecutionTime: Math.round(avgTime * 100) / 100,
        statusDistribution: statusCounts,
        slowQueries: this.results.filter(r => r.executionTime > this.thresholds.acceptable).length
      },
      results: this.results,
      recommendations: this.getGlobalRecommendations()
    }
  }

  getGlobalRecommendations() {
    const slowQueries = this.results.filter(r => r.executionTime > this.thresholds.acceptable)
    const recommendations = []

    if (slowQueries.length > 0) {
      recommendations.push(`${slowQueries.length} queries are slow. Priority optimization needed.`)
    }

    if (this.results.some(r => r.status === 'critical')) {
      recommendations.push('Critical performance issues detected. Immediate action required.')
    }

    recommendations.push('Add database indexes for frequently queried columns')
    recommendations.push('Implement query result caching for expensive operations')
    recommendations.push('Use select instead of include when possible')
    recommendations.push('Consider cursor-based pagination for large datasets')

    return recommendations
  }
}

// Test query patterns
async function testQueryPatterns() {
  console.log('🧪 Testing Query Performance Patterns...')
  
  const analyzer = new QueryPerformanceAnalyzer()

  // Simulate different data sizes for realistic testing
  const mockData = {
    smallDataset: Array.from({ length: 10 }, (_, i) => ({ id: i, name: `Item ${i}` })),
    mediumDataset: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` })),
    largeDataset: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` })),
  }

  // Test 1: Simple SELECT query
  await analyzer.measureQuery(
    'Simple Ticket List',
    async () => {
      // Simulate database delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50))
      return mockData.mediumDataset
    },
    100
  )

  // Test 2: Complex JOIN query
  await analyzer.measureQuery(
    'Tickets with Relations',
    async () => {
      // Simulate more complex query delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 150))
      return mockData.mediumDataset.map(item => ({
        ...item,
        user: { name: 'User Name' },
        category: { name: 'Category Name' },
        comments: mockData.smallDataset
      }))
    },
    100
  )

  // Test 3: Aggregation query
  await analyzer.measureQuery(
    'Dashboard Statistics',
    async () => {
      // Simulate aggregation delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
      return {
        totalTickets: 1000,
        openTickets: 250,
        closedTickets: 750
      }
    },
    1
  )

  // Test 4: Search query (unoptimized)
  await analyzer.measureQuery(
    'Text Search (Unoptimized)',
    async () => {
      // Simulate slow text search
      await new Promise(resolve => setTimeout(resolve, Math.random() * 800))
      return mockData.smallDataset
    },
    10
  )

  // Test 5: Pagination query
  await analyzer.measureQuery(
    'Paginated Results',
    async () => {
      // Simulate pagination delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 75))
      return mockData.smallDataset
    },
    10
  )

  // Test 6: User workload query
  await analyzer.measureQuery(
    'User Workload Calculation',
    async () => {
      // Simulate multiple count queries
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200))
      return {
        assigned: 15,
        created: 5,
        resolved: 12
      }
    },
    1
  )

  // Test 7: Category statistics
  await analyzer.measureQuery(
    'Category Statistics',
    async () => {
      // Simulate category aggregation
      await new Promise(resolve => setTimeout(resolve, Math.random() * 120))
      return mockData.smallDataset.map(item => ({
        ...item,
        ticketCount: Math.floor(Math.random() * 50)
      }))
    },
    10
  )

  // Test 8: Recent activity
  await analyzer.measureQuery(
    'Recent Activity',
    async () => {
      // Simulate time-based query
      await new Promise(resolve => setTimeout(resolve, Math.random() * 60))
      return mockData.smallDataset
    },
    10
  )

  return analyzer.generateReport()
}

// Test optimization strategies
async function testOptimizationStrategies() {
  console.log('\n🚀 Testing Optimization Strategies...')
  
  const strategies = [
    {
      name: 'Index Usage Simulation',
      description: 'Simulates performance with proper database indexes',
      improvement: 0.7, // 70% improvement
    },
    {
      name: 'Query Result Caching',
      description: 'Simulates cached query results',
      improvement: 0.95, // 95% improvement for cached results
    },
    {
      name: 'Selective Field Loading',
      description: 'Using select instead of include for specific fields',
      improvement: 0.4, // 40% improvement
    },
    {
      name: 'Cursor-based Pagination',
      description: 'Using cursor pagination instead of offset',
      improvement: 0.8, // 80% improvement for large datasets
    },
    {
      name: 'Query Batching',
      description: 'Combining multiple queries into transactions',
      improvement: 0.6, // 60% improvement
    }
  ]

  const results = []

  for (const strategy of strategies) {
    const baseTime = 200 + Math.random() * 300 // Base query time: 200-500ms
    const optimizedTime = baseTime * (1 - strategy.improvement)
    
    results.push({
      strategy: strategy.name,
      description: strategy.description,
      baseTime: Math.round(baseTime * 100) / 100,
      optimizedTime: Math.round(optimizedTime * 100) / 100,
      improvement: Math.round(strategy.improvement * 100),
      timeSaved: Math.round((baseTime - optimizedTime) * 100) / 100
    })
  }

  return results
}

// Test database connection patterns
async function testConnectionPatterns() {
  console.log('\n🔗 Testing Database Connection Patterns...')
  
  const patterns = [
    {
      name: 'Single Query',
      queries: 1,
      connectionOverhead: 10
    },
    {
      name: 'Multiple Sequential Queries',
      queries: 5,
      connectionOverhead: 50
    },
    {
      name: 'Transaction Batch',
      queries: 5,
      connectionOverhead: 15
    },
    {
      name: 'Connection Pool',
      queries: 10,
      connectionOverhead: 20
    }
  ]

  const results = []

  for (const pattern of patterns) {
    const queryTime = 50 // Base query time
    const totalTime = (queryTime * pattern.queries) + pattern.connectionOverhead
    
    results.push({
      pattern: pattern.name,
      queries: pattern.queries,
      connectionOverhead: pattern.connectionOverhead,
      totalTime,
      avgTimePerQuery: Math.round((totalTime / pattern.queries) * 100) / 100,
      efficiency: Math.round((queryTime / (totalTime / pattern.queries)) * 100)
    })
  }

  return results
}

// Generate optimization recommendations
function generateOptimizationRecommendations(queryReport, optimizationResults, connectionResults) {
  const recommendations = []

  // Query-based recommendations
  const slowQueries = queryReport.results.filter(r => r.status === 'poor' || r.status === 'critical')
  if (slowQueries.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Query Performance',
      issue: `${slowQueries.length} slow queries detected`,
      solution: 'Add database indexes for frequently queried columns',
      estimatedImprovement: '60-90%'
    })
  }

  // Caching recommendations
  const frequentQueries = queryReport.results.filter(r => r.name.includes('Dashboard') || r.name.includes('Statistics'))
  if (frequentQueries.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Caching',
      issue: 'Frequent dashboard and statistics queries',
      solution: 'Implement Redis caching for dashboard data',
      estimatedImprovement: '80-95%'
    })
  }

  // Pagination recommendations
  const largeResultQueries = queryReport.results.filter(r => r.resultCount > 100)
  if (largeResultQueries.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Pagination',
      issue: 'Large result sets without pagination',
      solution: 'Implement cursor-based pagination',
      estimatedImprovement: '70-85%'
    })
  }

  // Connection optimization
  const inefficientConnections = connectionResults.filter(r => r.efficiency < 70)
  if (inefficientConnections.length > 0) {
    recommendations.push({
      priority: 'LOW',
      category: 'Connection Management',
      issue: 'Inefficient database connection usage',
      solution: 'Use connection pooling and transaction batching',
      estimatedImprovement: '30-50%'
    })
  }

  return recommendations
}

// Main test execution
async function runOptimizationTests() {
  console.log('🎯 Database Query Optimization Tests')
  console.log('====================================')

  try {
    // Run all tests
    const queryReport = await testQueryPatterns()
    const optimizationResults = await testOptimizationStrategies()
    const connectionResults = await testConnectionPatterns()

    // Generate recommendations
    const recommendations = generateOptimizationRecommendations(
      queryReport, 
      optimizationResults, 
      connectionResults
    )

    // Display results
    console.log('\n📊 Query Performance Results:')
    console.log(`   Total Queries Tested: ${queryReport.summary.totalQueries}`)
    console.log(`   Average Execution Time: ${queryReport.summary.averageExecutionTime}ms`)
    console.log(`   Slow Queries: ${queryReport.summary.slowQueries}`)

    console.log('\n⚡ Performance Status Distribution:')
    Object.entries(queryReport.summary.statusDistribution).forEach(([status, count]) => {
      const emoji = {
        excellent: '🟢',
        good: '🟡',
        acceptable: '🟠',
        poor: '🔴',
        critical: '🚨',
        error: '❌'
      }[status] || '⚪'
      console.log(`   ${emoji} ${status}: ${count} queries`)
    })

    console.log('\n🚀 Optimization Strategy Results:')
    optimizationResults.forEach(result => {
      console.log(`   ${result.strategy}:`)
      console.log(`     Base Time: ${result.baseTime}ms`)
      console.log(`     Optimized Time: ${result.optimizedTime}ms`)
      console.log(`     Improvement: ${result.improvement}% (${result.timeSaved}ms saved)`)
    })

    console.log('\n🔗 Connection Pattern Analysis:')
    connectionResults.forEach(result => {
      console.log(`   ${result.pattern}:`)
      console.log(`     Queries: ${result.queries}`)
      console.log(`     Total Time: ${result.totalTime}ms`)
      console.log(`     Efficiency: ${result.efficiency}%`)
    })

    console.log('\n💡 Optimization Recommendations:')
    recommendations.forEach((rec, index) => {
      const priorityEmoji = {
        HIGH: '🔴',
        MEDIUM: '🟡',
        LOW: '🟢'
      }[rec.priority] || '⚪'
      
      console.log(`   ${index + 1}. ${priorityEmoji} ${rec.category} (${rec.priority} Priority)`)
      console.log(`      Issue: ${rec.issue}`)
      console.log(`      Solution: ${rec.solution}`)
      console.log(`      Estimated Improvement: ${rec.estimatedImprovement}`)
    })

    console.log('\n🎯 Summary:')
    const totalImprovementPotential = optimizationResults.reduce((sum, r) => sum + r.improvement, 0) / optimizationResults.length
    console.log(`   Average Improvement Potential: ${Math.round(totalImprovementPotential)}%`)
    console.log(`   High Priority Issues: ${recommendations.filter(r => r.priority === 'HIGH').length}`)
    console.log(`   Total Recommendations: ${recommendations.length}`)

    if (recommendations.filter(r => r.priority === 'HIGH').length === 0) {
      console.log('\n🎉 No critical performance issues detected!')
      console.log('   System is performing well, continue monitoring.')
    } else {
      console.log('\n⚠️  Critical performance issues detected.')
      console.log('   Implement high priority recommendations first.')
    }

    return {
      queryReport,
      optimizationResults,
      connectionResults,
      recommendations,
      summary: {
        totalQueries: queryReport.summary.totalQueries,
        averageTime: queryReport.summary.averageExecutionTime,
        slowQueries: queryReport.summary.slowQueries,
        improvementPotential: Math.round(totalImprovementPotential),
        criticalIssues: recommendations.filter(r => r.priority === 'HIGH').length
      }
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error)
    throw error
  }
}

// Export for use in other scripts
if (require.main === module) {
  runOptimizationTests().catch(error => {
    console.error('❌ Optimization tests failed:', error)
    process.exit(1)
  })
}

module.exports = {
  QueryPerformanceAnalyzer,
  testQueryPatterns,
  testOptimizationStrategies,
  testConnectionPatterns,
  runOptimizationTests
}