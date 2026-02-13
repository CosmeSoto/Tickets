#!/usr/bin/env node

/**
 * Performance Benchmark Script
 * Runs load tests and performance benchmarks against the application
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const BENCHMARK_CONFIG = {
  baseUrl: process.env.BENCHMARK_URL || 'http://localhost:3000',
  duration: process.env.BENCHMARK_DURATION || '30s',
  connections: process.env.BENCHMARK_CONNECTIONS || 10,
  pipelining: process.env.BENCHMARK_PIPELINING || 1,
  outputDir: path.join(__dirname, '../benchmark-results'),
}

const ENDPOINTS = [
  {
    name: 'Health Check',
    path: '/api/health/database',
    method: 'GET',
    expectedStatus: 200,
  },
  {
    name: 'Categories API',
    path: '/api/categories',
    method: 'GET',
    expectedStatus: [200, 401], // May require auth
  },
  {
    name: 'Tickets API',
    path: '/api/tickets?page=1&limit=10',
    method: 'GET',
    expectedStatus: [200, 401], // May require auth
  },
  {
    name: 'Dashboard Stats',
    path: '/api/dashboard/stats',
    method: 'GET',
    expectedStatus: [200, 401], // May require auth
  },
]

// Ensure output directory exists
if (!fs.existsSync(BENCHMARK_CONFIG.outputDir)) {
  fs.mkdirSync(BENCHMARK_CONFIG.outputDir, { recursive: true })
}

/**
 * Run autocannon benchmark for a specific endpoint
 */
async function runBenchmark(endpoint) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Benchmarking: ${endpoint.name}`)
    console.log(`   URL: ${BENCHMARK_CONFIG.baseUrl}${endpoint.path}`)
    console.log(`   Duration: ${BENCHMARK_CONFIG.duration}`)
    console.log(`   Connections: ${BENCHMARK_CONFIG.connections}`)

    const args = [
      BENCHMARK_CONFIG.baseUrl + endpoint.path,
      '-d', BENCHMARK_CONFIG.duration,
      '-c', BENCHMARK_CONFIG.connections,
      '-p', BENCHMARK_CONFIG.pipelining,
      '-m', endpoint.method,
      '--json',
    ]

    const autocannon = spawn('npx', ['autocannon', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let output = ''
    let errorOutput = ''

    autocannon.stdout.on('data', (data) => {
      output += data.toString()
    })

    autocannon.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    autocannon.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ Benchmark failed for ${endpoint.name}`)
        console.error(`Error: ${errorOutput}`)
        reject(new Error(`Autocannon exited with code ${code}`))
        return
      }

      try {
        const result = JSON.parse(output)
        
        // Save detailed results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `${endpoint.name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.json`
        const filepath = path.join(BENCHMARK_CONFIG.outputDir, filename)
        
        fs.writeFileSync(filepath, JSON.stringify(result, null, 2))
        
        console.log(`✅ Benchmark completed for ${endpoint.name}`)
        console.log(`   Requests/sec: ${result.requests.average || 0}`)
        console.log(`   Latency avg: ${result.latency.average || 0}ms`)
        console.log(`   Latency p99: ${result.latency.p99 || 0}ms`)
        console.log(`   Throughput: ${((result.throughput.average || 0) / 1024 / 1024).toFixed(2)} MB/s`)
        console.log(`   Errors: ${result.errors || 0}`)
        console.log(`   Results saved: ${filename}`)

        resolve({
          endpoint: endpoint.name,
          url: endpoint.path,
          ...result,
          filepath,
        })
      } catch (error) {
        console.error(`❌ Failed to parse results for ${endpoint.name}`)
        console.error(`Output: ${output}`)
        reject(error)
      }
    })

    autocannon.on('error', (error) => {
      console.error(`❌ Failed to start benchmark for ${endpoint.name}`)
      reject(error)
    })
  })
}

/**
 * Generate performance report
 */
function generateReport(results) {
  const timestamp = new Date().toISOString()
  const reportData = {
    timestamp,
    config: BENCHMARK_CONFIG,
    results: results.map(result => ({
      endpoint: result.endpoint,
      url: result.url,
      summary: {
        requestsPerSecond: result.requests?.average || 0,
        latencyAverage: result.latency?.average || 0,
        latencyP95: result.latency?.p95 || 0,
        latencyP99: result.latency?.p99 || 0,
        throughputMBps: ((result.throughput?.average || 0) / 1024 / 1024).toFixed(2),
        errors: result.errors || 0,
        timeouts: result.timeouts || 0,
        duration: result.duration || 0,
        connections: result.connections || 0,
      },
      performance: {
        fast: (result.latency?.average || Infinity) < 100,
        acceptable: (result.latency?.average || Infinity) < 500,
        slow: (result.latency?.average || Infinity) >= 500,
      }
    })),
    summary: {
      totalEndpoints: results.length,
      averageLatency: results.reduce((sum, r) => sum + (r.latency?.average || 0), 0) / results.length,
      totalRequests: results.reduce((sum, r) => sum + (r.requests?.total || 0), 0),
      totalErrors: results.reduce((sum, r) => sum + (r.errors || 0), 0),
      fastEndpoints: results.filter(r => (r.latency?.average || Infinity) < 100).length,
      acceptableEndpoints: results.filter(r => (r.latency?.average || Infinity) < 500).length,
      slowEndpoints: results.filter(r => (r.latency?.average || Infinity) >= 500).length,
    }
  }

  // Save report
  const reportFilename = `performance-report-${timestamp.replace(/[:.]/g, '-')}.json`
  const reportPath = path.join(BENCHMARK_CONFIG.outputDir, reportFilename)
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2))

  // Generate markdown report
  const markdownReport = generateMarkdownReport(reportData)
  const markdownPath = path.join(BENCHMARK_CONFIG.outputDir, `performance-report-${timestamp.replace(/[:.]/g, '-')}.md`)
  fs.writeFileSync(markdownPath, markdownReport)

  return { reportData, reportPath, markdownPath }
}

/**
 * Generate markdown performance report
 */
function generateMarkdownReport(data) {
  const { timestamp, config, results, summary } = data

  return `# Performance Benchmark Report

**Generated:** ${timestamp}
**Base URL:** ${config.baseUrl}
**Duration:** ${config.duration}
**Connections:** ${config.connections}

## Summary

- **Total Endpoints Tested:** ${summary.totalEndpoints}
- **Average Latency:** ${summary.averageLatency.toFixed(2)}ms
- **Total Requests:** ${summary.totalRequests.toLocaleString()}
- **Total Errors:** ${summary.totalErrors}
- **Fast Endpoints (< 100ms):** ${summary.fastEndpoints}
- **Acceptable Endpoints (< 500ms):** ${summary.acceptableEndpoints}
- **Slow Endpoints (≥ 500ms):** ${summary.slowEndpoints}

## Endpoint Results

| Endpoint | Requests/sec | Avg Latency | P95 Latency | P99 Latency | Throughput | Errors | Status |
|----------|--------------|-------------|-------------|-------------|------------|--------|--------|
${results.map(r => {
  const status = r.performance.fast ? '🟢 Fast' : r.performance.acceptable ? '🟡 OK' : '🔴 Slow'
  return `| ${r.endpoint} | ${r.summary.requestsPerSecond.toFixed(0)} | ${r.summary.latencyAverage.toFixed(2)}ms | ${r.summary.latencyP95.toFixed(2)}ms | ${r.summary.latencyP99.toFixed(2)}ms | ${r.summary.throughputMBps} MB/s | ${r.summary.errors} | ${status} |`
}).join('\n')}

## Performance Analysis

### Fast Endpoints (< 100ms)
${results.filter(r => r.performance.fast).map(r => `- ✅ **${r.endpoint}**: ${r.summary.latencyAverage.toFixed(2)}ms average`).join('\n') || 'None'}

### Acceptable Endpoints (100-500ms)
${results.filter(r => r.performance.acceptable && !r.performance.fast).map(r => `- ⚠️ **${r.endpoint}**: ${r.summary.latencyAverage.toFixed(2)}ms average`).join('\n') || 'None'}

### Slow Endpoints (≥ 500ms)
${results.filter(r => r.performance.slow).map(r => `- 🚨 **${r.endpoint}**: ${r.summary.latencyAverage.toFixed(2)}ms average - Needs optimization`).join('\n') || 'None'}

## Recommendations

${summary.slowEndpoints > 0 ? `
### 🚨 Critical Issues
- ${summary.slowEndpoints} endpoint(s) are performing slowly (≥ 500ms)
- Consider optimizing database queries, adding caching, or improving server resources
` : ''}

${summary.acceptableEndpoints < summary.totalEndpoints ? `
### ⚠️ Performance Improvements
- Consider adding caching for frequently accessed endpoints
- Optimize database queries and add proper indexing
- Implement response compression
` : ''}

${summary.totalErrors > 0 ? `
### 🔧 Error Handling
- ${summary.totalErrors} total errors occurred during testing
- Review error logs and implement proper error handling
- Consider rate limiting and circuit breaker patterns
` : ''}

### 📈 General Recommendations
- Monitor performance regularly with automated benchmarks
- Set up performance alerts for critical endpoints
- Consider implementing CDN for static assets
- Use connection pooling and keep-alive connections
- Implement proper caching strategies (Redis, in-memory, HTTP caching)

---
*Report generated by Performance Benchmark Script*
`
}

/**
 * Main benchmark execution
 */
async function main() {
  console.log('🎯 Starting Performance Benchmarks')
  console.log(`📊 Configuration:`)
  console.log(`   Base URL: ${BENCHMARK_CONFIG.baseUrl}`)
  console.log(`   Duration: ${BENCHMARK_CONFIG.duration}`)
  console.log(`   Connections: ${BENCHMARK_CONFIG.connections}`)
  console.log(`   Output Directory: ${BENCHMARK_CONFIG.outputDir}`)

  const results = []

  try {
    // Run benchmarks for each endpoint
    for (const endpoint of ENDPOINTS) {
      try {
        const result = await runBenchmark(endpoint)
        results.push(result)
      } catch (error) {
        console.error(`❌ Failed to benchmark ${endpoint.name}:`, error.message)
        // Continue with other endpoints
      }
    }

    if (results.length === 0) {
      console.error('❌ No benchmarks completed successfully')
      process.exit(1)
    }

    // Generate report
    console.log('\n📊 Generating Performance Report...')
    const { reportData, reportPath, markdownPath } = generateReport(results)

    console.log('\n✅ Performance Benchmarks Completed!')
    console.log(`📄 JSON Report: ${reportPath}`)
    console.log(`📝 Markdown Report: ${markdownPath}`)

    // Print summary
    console.log('\n📈 Summary:')
    console.log(`   Total Endpoints: ${reportData.summary.totalEndpoints}`)
    console.log(`   Average Latency: ${reportData.summary.averageLatency.toFixed(2)}ms`)
    console.log(`   Total Requests: ${reportData.summary.totalRequests.toLocaleString()}`)
    console.log(`   Total Errors: ${reportData.summary.totalErrors}`)
    console.log(`   Fast Endpoints: ${reportData.summary.fastEndpoints}`)
    console.log(`   Slow Endpoints: ${reportData.summary.slowEndpoints}`)

    if (reportData.summary.slowEndpoints > 0) {
      console.log('\n⚠️  Warning: Some endpoints are performing slowly. Check the report for details.')
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Benchmark execution failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
}

module.exports = {
  runBenchmark,
  generateReport,
  BENCHMARK_CONFIG,
  ENDPOINTS,
}