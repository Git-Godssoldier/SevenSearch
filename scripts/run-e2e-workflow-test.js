#!/usr/bin/env node

/**
 * SevenSearch E2E Workflow Test Runner
 * 
 * A lightweight test runner that validates the complete user workflow
 * without requiring heavy testing frameworks
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Test configuration
const config = {
  baseURL: process.env.TEST_URL || 'http://localhost:3000',
  timeout: 30000,
  searchQuery: 'artificial intelligence trends 2024'
};

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Utility functions
function log(message, color = 'white') {
  console.log(colors[color] + message + colors.reset);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'SevenSearch-E2E-Test/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...options.headers
      },
      timeout: config.timeout
    };

    if (options.data) {
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(options.data);
    }

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
          ok: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.data) {
      req.write(options.data);
    }
    
    req.end();
  });
}

async function testStep(name, testFn) {
  try {
    log(`\n🧪 ${name}`, 'cyan');
    const result = await testFn();
    log(`✅ ${name} - PASSED`, 'green');
    return { passed: true, result };
  } catch (error) {
    log(`❌ ${name} - FAILED: ${error.message}`, 'red');
    return { passed: false, error: error.message };
  }
}

// Test functions
async function testHomepageAccessibility() {
  const response = await makeRequest(config.baseURL);
  
  if (!response.ok) {
    throw new Error(`Homepage not accessible: ${response.status}`);
  }
  
  // Check for essential HTML elements
  const html = response.data;
  const checks = [
    { name: 'Title tag', test: /<title[^>]*>.*<\/title>/i },
    { name: 'Search form', test: /<form[^>]*>|<textarea[^>]*>|<input[^>]*>/i },
    { name: 'Main heading', test: /<h1[^>]*>.*<\/h1>/i },
    { name: 'JavaScript bundle', test: /_next\/static\/|\/bundle\.|<script/i }
  ];
  
  const failed = checks.filter(check => !check.test.test(html));
  
  if (failed.length > 0) {
    throw new Error(`Missing elements: ${failed.map(f => f.name).join(', ')}`);
  }
  
  return { 
    status: response.status, 
    contentLength: html.length,
    hasEssentialElements: true 
  };
}

async function testSearchAPIEndpoint() {
  const searchData = JSON.stringify({
    query: config.searchQuery,
    category: 'web'
  });
  
  const response = await makeRequest(`${config.baseURL}/api/search`, {
    method: 'POST',
    data: searchData,
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Search API failed: ${response.status}`);
  }
  
  let responseData;
  try {
    responseData = JSON.parse(response.data);
  } catch (e) {
    throw new Error('Search API returned invalid JSON');
  }
  
  // Validate response structure
  const hasResults = responseData.results && Array.isArray(responseData.results);
  const hasSearchId = responseData.searchId && typeof responseData.searchId === 'string';
  const hasValidation = responseData.validation && typeof responseData.validation === 'object';
  
  if (!hasSearchId) {
    throw new Error('Response missing searchId');
  }
  
  return {
    searchId: responseData.searchId,
    resultCount: hasResults ? responseData.results.length : 0,
    hasValidation,
    responseTime: response.headers['x-response-time'] || 'unknown'
  };
}

async function testStreamingEndpoint() {
  const searchData = JSON.stringify({
    query: config.searchQuery,
    searchId: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  });
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(`${config.baseURL}/api/enhance-search`);
    const lib = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain',
        'Cache-Control': 'no-cache'
      }
    };
    
    const req = lib.request(reqOptions, (res) => {
      let chunks = [];
      let chunkCount = 0;
      
      res.on('data', (chunk) => {
        chunkCount++;
        const text = chunk.toString();
        chunks.push(text);
        
        // Look for streaming indicators
        if (text.includes('workflow_started') || text.includes('step')) {
          log(`  📡 Received streaming chunk ${chunkCount}: ${text.substring(0, 50)}...`, 'blue');
        }
      });
      
      res.on('end', () => {
        if (chunkCount === 0) {
          reject(new Error('No streaming chunks received'));
        } else if (chunkCount === 1) {
          reject(new Error('Only one chunk received - streaming may not be working'));
        } else {
          resolve({
            chunkCount,
            totalData: chunks.join(''),
            streamingWorking: true,
            contentType: res.headers['content-type']
          });
        }
      });
      
      // Timeout for streaming test
      setTimeout(() => {
        if (chunkCount > 1) {
          res.destroy();
          resolve({
            chunkCount,
            totalData: chunks.join(''),
            streamingWorking: true,
            timedOut: true
          });
        }
      }, 8000);
    });
    
    req.on('error', reject);
    req.write(searchData);
    req.end();
  });
}

async function testRateLimiting() {
  log('  🛡️  Testing rate limiting with multiple requests...', 'yellow');
  
  const requests = Array(5).fill().map((_, i) => 
    makeRequest(`${config.baseURL}/api/search`, {
      method: 'POST',
      data: JSON.stringify({ query: `rate test ${i}`, category: 'web' })
    }).catch(error => ({ error: error.message, index: i }))
  );
  
  const results = await Promise.all(requests);
  const rateLimited = results.filter(r => r.status === 429);
  const errors = results.filter(r => r.error);
  
  return {
    totalRequests: results.length,
    rateLimitedRequests: rateLimited.length,
    errorRequests: errors.length,
    rateLimitingActive: rateLimited.length > 0,
    allSuccessful: results.every(r => r.ok || r.status === 429)
  };
}

async function testWebhookEndpoint() {
  const webhookData = JSON.stringify({
    searchId: `test_${Date.now()}`,
    step: 1,
    type: 'test_progress',
    payload: { message: 'Test webhook' },
    timestamp: new Date().toISOString()
  });
  
  const response = await makeRequest(`${config.baseURL}/api/webhooks/search-progress`, {
    method: 'POST',
    data: webhookData
  });
  
  if (!response.ok) {
    throw new Error(`Webhook endpoint failed: ${response.status}`);
  }
  
  let responseData;
  try {
    responseData = JSON.parse(response.data);
  } catch (e) {
    throw new Error('Webhook returned invalid JSON');
  }
  
  if (!responseData.success) {
    throw new Error('Webhook did not return success response');
  }
  
  return {
    status: response.status,
    success: responseData.success,
    message: responseData.message
  };
}

async function testHealthAndPerformance() {
  const startTime = Date.now();
  const response = await makeRequest(config.baseURL);
  const endTime = Date.now();
  
  const responseTime = endTime - startTime;
  const hasSecurityHeaders = {
    xContentTypeOptions: !!response.headers['x-content-type-options'],
    xFrameOptions: !!response.headers['x-frame-options'],
    xXSSProtection: !!response.headers['x-xss-protection']
  };
  
  return {
    responseTime,
    status: response.status,
    securityHeaders: hasSecurityHeaders,
    securityHeaderCount: Object.values(hasSecurityHeaders).filter(Boolean).length
  };
}

// Main test runner
async function runWorkflowTests() {
  log('🚀 SevenSearch E2E Workflow Test Suite', 'magenta');
  log('=' + '='.repeat(50), 'magenta');
  log(`Testing URL: ${config.baseURL}`, 'cyan');
  log(`Search Query: "${config.searchQuery}"`, 'cyan');
  
  const testResults = {};
  
  // Test 1: Homepage Accessibility
  testResults.homepage = await testStep(
    'Homepage Accessibility and Structure', 
    testHomepageAccessibility
  );
  
  // Test 2: Search API Functionality
  testResults.searchAPI = await testStep(
    'Search API Endpoint Functionality',
    testSearchAPIEndpoint
  );
  
  // Test 3: Streaming Endpoint
  testResults.streaming = await testStep(
    'Streaming Search with Real-time Updates',
    testStreamingEndpoint
  );
  
  // Test 4: Webhook Infrastructure
  testResults.webhook = await testStep(
    'Webhook Progress Update Endpoint',
    testWebhookEndpoint
  );
  
  // Test 5: Rate Limiting
  testResults.rateLimiting = await testStep(
    'Rate Limiting Protection',
    testRateLimiting
  );
  
  // Test 6: Performance and Security
  testResults.performance = await testStep(
    'Performance and Security Headers',
    testHealthAndPerformance
  );
  
  // Summary
  log('\n' + '='.repeat(60), 'magenta');
  log('📊 TEST RESULTS SUMMARY', 'magenta');
  log('='.repeat(60), 'magenta');
  
  const totalTests = Object.keys(testResults).length;
  const passedTests = Object.values(testResults).filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  
  Object.entries(testResults).forEach(([name, result]) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const color = result.passed ? 'green' : 'red';
    log(`${status} ${name}`, color);
    
    if (result.passed && result.result) {
      const details = Object.entries(result.result)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      if (details.length < 100) {
        log(`     ${details}`, 'blue');
      }
    } else if (!result.passed) {
      log(`     Error: ${result.error}`, 'red');
    }
  });
  
  log('\n' + '='.repeat(60), 'magenta');
  log(`📈 OVERALL RESULTS: ${passedTests}/${totalTests} tests passed`, 
      passedTests === totalTests ? 'green' : 'yellow');
      
  if (failedTests > 0) {
    log(`⚠️  ${failedTests} test(s) failed - review implementation`, 'yellow');
  } else {
    log('🎉 All tests passed! SevenSearch is working correctly', 'green');
  }
  
  log('='.repeat(60), 'magenta');
  
  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Handle command line execution
if (require.main === module) {
  runWorkflowTests().catch(error => {
    log(`💥 Test runner failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runWorkflowTests, config };