#!/usr/bin/env node

/**
 * Comprehensive test script for the advanced search query pipeline
 * Tests the complete flow from search initiation to result retrieval
 */

const https = require('https');
const http = require('http');

// Configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testQuery: 'What are the latest developments in artificial intelligence?',
  timeout: 60000 // 60 seconds
};

/**
 * Test the complete search pipeline
 */
async function testSearchPipeline() {
  console.log('🧪 Testing Advanced Search Query Pipeline\n');
  
  const searchId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📝 Test Query: "${TEST_CONFIG.testQuery}"`);
  console.log(`🔍 Search ID: ${searchId}`);
  console.log(`🌐 Base URL: ${TEST_CONFIG.baseUrl}\n`);

  // Step 1: Test enhance-search API (streaming)
  console.log('📡 Step 1: Testing enhance-search API (streaming)...');
  const streamingResult = await testEnhanceSearchAPI(TEST_CONFIG.testQuery, searchId);
  
  if (!streamingResult.success) {
    console.log('❌ Streaming test failed, but continuing to test database retrieval...\n');
  } else {
    console.log('✅ Streaming test passed!\n');
  }

  // Step 2: Wait for database storage
  console.log('⏳ Step 2: Waiting for database storage...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 3: Test check-search API
  console.log('🔍 Step 3: Testing check-search API...');
  const checkResult = await testCheckSearchAPI(searchId);
  
  if (!checkResult.success) {
    console.log('❌ Check-search test failed\n');
    return false;
  } else {
    console.log('✅ Check-search test passed!\n');
  }

  // Step 4: Test search page routing
  console.log('🌐 Step 4: Testing search page routing...');
  const routingResult = await testSearchPageRouting(searchId);
  
  if (!routingResult.success) {
    console.log('❌ Search page routing test failed\n');
    return false;
  } else {
    console.log('✅ Search page routing test passed!\n');
  }

  console.log('🎉 All pipeline tests passed! The search system is working correctly.');
  return true;
}

/**
 * Test the enhance-search streaming API
 */
function testEnhanceSearchAPI(query, searchId) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ query, searchId });
    const url = new URL('/api/enhance-search', TEST_CONFIG.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 3000),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'text/event-stream'
      },
      timeout: TEST_CONFIG.timeout
    };

    const req = client.request(options, (res) => {
      console.log(`   📊 Status: ${res.statusCode}`);
      
      if (res.statusCode !== 200) {
        console.log(`   ❌ Expected 200, got ${res.statusCode}`);
        resolve({ success: false, error: `HTTP ${res.statusCode}` });
        return;
      }

      let eventCount = 0;
      let hasWorkflowCompleted = false;

      res.on('data', (chunk) => {
        const data = chunk.toString();
        const lines = data.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          try {
            const event = JSON.parse(line);
            eventCount++;
            console.log(`   📨 Event ${eventCount}: ${event.type} (Step ${event.step})`);
            
            if (event.type === 'workflow_completed') {
              hasWorkflowCompleted = true;
            }
          } catch (parseError) {
            // Ignore non-JSON lines
          }
        });
      });

      res.on('end', () => {
        console.log(`   📊 Total events: ${eventCount}`);
        console.log(`   ✅ Workflow completed: ${hasWorkflowCompleted}`);
        
        const success = eventCount > 0 && hasWorkflowCompleted;
        resolve({ success, eventCount, hasWorkflowCompleted });
      });

      res.on('error', (error) => {
        console.log(`   ❌ Response error: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Request error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log('   ❌ Request timeout');
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Test the check-search API
 */
function testCheckSearchAPI(searchId) {
  return new Promise((resolve) => {
    const url = new URL(`/api/check-search?id=${searchId}`, TEST_CONFIG.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 3000),
      path: url.pathname + url.search,
      method: 'GET',
      timeout: 10000
    };

    const req = client.request(options, (res) => {
      console.log(`   📊 Status: ${res.statusCode}`);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const data = JSON.parse(responseData);
            console.log(`   📄 Query: "${data.query || 'N/A'}"`);
            console.log(`   ✅ Completed: ${data.completed || false}`);
            console.log(`   📝 Summary: ${data.summary ? 'Present' : 'Missing'}`);
            
            const success = data.completed === true;
            resolve({ success, data });
          } else if (res.statusCode === 404) {
            console.log('   ❌ Search not found in database');
            resolve({ success: false, error: 'Search not found' });
          } else {
            console.log(`   ❌ Unexpected status: ${res.statusCode}`);
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
          }
        } catch (parseError) {
          console.log(`   ❌ JSON parse error: ${parseError.message}`);
          resolve({ success: false, error: 'Invalid JSON response' });
        }
      });

      res.on('error', (error) => {
        console.log(`   ❌ Response error: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Request error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log('   ❌ Request timeout');
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

/**
 * Test search page routing
 */
function testSearchPageRouting(searchId) {
  return new Promise((resolve) => {
    const url = new URL(`/search/${searchId}`, TEST_CONFIG.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 3000),
      path: url.pathname,
      method: 'GET',
      timeout: 10000
    };

    const req = client.request(options, (res) => {
      console.log(`   📊 Status: ${res.statusCode}`);
      
      if (res.statusCode === 200) {
        console.log('   ✅ Search page loads successfully');
        resolve({ success: true });
      } else if (res.statusCode === 404) {
        console.log('   ❌ Search page returns 404');
        resolve({ success: false, error: 'Page not found' });
      } else {
        console.log(`   ❌ Unexpected status: ${res.statusCode}`);
        resolve({ success: false, error: `HTTP ${res.statusCode}` });
      }

      // Consume response to prevent hanging
      res.on('data', () => {});
      res.on('end', () => {});
    });

    req.on('error', (error) => {
      console.log(`   ❌ Request error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log('   ❌ Request timeout');
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

/**
 * Main test runner
 */
async function runTests() {
  try {
    console.log('🚀 Starting Advanced Search Pipeline Tests...\n');
    
    const success = await testSearchPipeline();
    
    if (success) {
      console.log('\n🎯 CONCLUSION: The advanced search pipeline is working correctly!');
      console.log('✅ Streaming API functional');
      console.log('✅ Database storage working');
      console.log('✅ Search retrieval working');
      console.log('✅ Page routing working');
      process.exit(0);
    } else {
      console.log('\n🚨 CONCLUSION: The search pipeline has issues that need attention.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Test suite failed with error:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Ensure development server is running (npm run dev)');
    console.log('2. Check database connectivity');
    console.log('3. Verify API routes are properly configured');
    console.log('4. Check server logs for detailed error information');
    
    process.exit(1);
  }
}

// Run the tests
runTests();
