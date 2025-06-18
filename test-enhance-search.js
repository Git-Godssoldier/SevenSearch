#!/usr/bin/env node

/**
 * Test script to verify the enhance-search API route is working properly
 * This script tests the streaming functionality and verifies complete responses
 */

const https = require('https');
const http = require('http');

// Configuration
const TEST_CONFIG = {
  // Change this to your local development server or deployed URL
  baseUrl: 'http://localhost:3000',
  // Test query
  query: 'What is artificial intelligence?',
  // Search ID for tracking
  searchId: `test-${Date.now()}`,
  // Timeout for the test
  timeout: 30000
};

/**
 * Make a POST request to the enhance-search API
 */
function testEnhanceSearchAPI() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: TEST_CONFIG.query,
      searchId: TEST_CONFIG.searchId
    });

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

    console.log(`🚀 Testing enhance-search API at: ${TEST_CONFIG.baseUrl}/api/enhance-search`);
    console.log(`📝 Query: "${TEST_CONFIG.query}"`);
    console.log(`🔍 Search ID: ${TEST_CONFIG.searchId}`);
    console.log('⏳ Waiting for response...\n');

    const req = client.request(options, (res) => {
      console.log(`📡 Response Status: ${res.statusCode}`);
      console.log(`📋 Response Headers:`, res.headers);
      console.log('📊 Streaming Events:\n');

      let eventCount = 0;
      let lastEventTime = Date.now();
      let responseData = '';
      let hasWorkflowStarted = false;
      let hasWorkflowCompleted = false;

      res.on('data', (chunk) => {
        const data = chunk.toString();
        responseData += data;
        
        // Parse streaming events
        const lines = data.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          try {
            const event = JSON.parse(line);
            eventCount++;
            lastEventTime = Date.now();
            
            console.log(`📨 Event ${eventCount}: ${event.type} (Step ${event.step})`);
            if (event.payload?.description) {
              console.log(`   📄 Description: ${event.payload.description}`);
            }
            if (event.payload?.enhancedQuery) {
              console.log(`   🔍 Enhanced Query: ${event.payload.enhancedQuery}`);
            }
            if (event.payload?.resultCount) {
              console.log(`   📊 Results: ${event.payload.resultCount}`);
            }
            if (event.error) {
              console.log(`   ❌ Error: ${event.payload?.message || 'Unknown error'}`);
            }
            
            // Track workflow progress
            if (event.type === 'workflow_started') {
              hasWorkflowStarted = true;
            }
            if (event.type === 'workflow_completed') {
              hasWorkflowCompleted = true;
            }
            
            console.log(''); // Empty line for readability
          } catch (parseError) {
            // Ignore non-JSON lines
          }
        });
      });

      res.on('end', () => {
        const duration = Date.now() - lastEventTime;
        
        console.log('🏁 Stream ended');
        console.log(`📊 Total events received: ${eventCount}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`✅ Workflow started: ${hasWorkflowStarted}`);
        console.log(`✅ Workflow completed: ${hasWorkflowCompleted}`);
        
        // Determine test result
        const success = eventCount > 0 && hasWorkflowStarted && hasWorkflowCompleted;
        
        if (success) {
          console.log('\n🎉 TEST PASSED: API is working correctly!');
          console.log('✅ Streaming is functional');
          console.log('✅ Events are being sent properly');
          console.log('✅ Workflow completes successfully');
        } else {
          console.log('\n❌ TEST FAILED: Issues detected');
          if (eventCount === 0) console.log('❌ No events received');
          if (!hasWorkflowStarted) console.log('❌ Workflow did not start');
          if (!hasWorkflowCompleted) console.log('❌ Workflow did not complete');
        }
        
        resolve({
          success,
          eventCount,
          hasWorkflowStarted,
          hasWorkflowCompleted,
          responseData
        });
      });

      res.on('error', (error) => {
        console.error('❌ Response error:', error);
        reject(error);
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error);
      reject(error);
    });

    req.on('timeout', () => {
      console.error('❌ Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // Send the request
    req.write(postData);
    req.end();
  });
}

/**
 * Main test function
 */
async function runTest() {
  try {
    console.log('🧪 Starting enhance-search API test...\n');
    
    const result = await testEnhanceSearchAPI();
    
    if (result.success) {
      console.log('\n🎯 CONCLUSION: The enhance-search API is working properly!');
      process.exit(0);
    } else {
      console.log('\n🚨 CONCLUSION: The enhance-search API needs further investigation.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Test failed with error:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure your development server is running (npm run dev)');
    console.log('2. Check if the server is accessible at the configured URL');
    console.log('3. Verify the API route exists and is properly configured');
    console.log('4. Check server logs for any errors');
    
    process.exit(1);
  }
}

// Run the test
runTest();
