# SevenSearch E2E Testing Guide

## 🧪 End-to-End User Workflow Testing

This guide describes how to run comprehensive end-to-end tests for SevenSearch to validate all the enhanced features including streaming, real-time updates, UI improvements, and rate limiting.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- SevenSearch application running (either locally or deployed)
- Network access to the application

### Running Tests

#### 1. Test Local Development Server
```bash
# Start the development server first
npm run dev

# In another terminal, run E2E tests
npm run test:e2e:dev
```

#### 2. Test Production Deployment
```bash
# Update the URL in package.json or use environment variable
TEST_URL=https://your-app.vercel.app npm run test:e2e:prod
```

#### 3. Run All Tests (Default)
```bash
npm test
# or
npm run test:e2e
```

## 📋 Test Coverage

Our E2E test suite validates the complete user workflow:

### ✅ **Core Functionality Tests**

1. **Homepage Accessibility** 
   - Verifies homepage loads correctly
   - Checks for essential HTML elements
   - Validates search form presence
   - Confirms JavaScript bundle loading

2. **Search API Endpoint**
   - Tests POST `/api/search` functionality
   - Validates JSON response structure
   - Checks for required fields (searchId, results, validation)
   - Measures API response time

3. **Streaming Search Implementation**
   - Tests POST `/api/enhance-search` streaming
   - Validates multiple chunk delivery (fixes Vercel streaming bug)
   - Monitors real-time progress updates
   - Confirms proper content-type headers

4. **Webhook Infrastructure**
   - Tests POST `/api/webhooks/search-progress`
   - Validates progress update storage
   - Checks webhook response format
   - Verifies real-time communication pipeline

### 🛡️ **Security & Performance Tests**

5. **Rate Limiting Protection**
   - Tests multiple rapid API requests
   - Validates 429 status code responses
   - Confirms rate limiting middleware functionality
   - Checks different endpoint limits

6. **Performance & Security Headers**
   - Measures homepage response time
   - Validates security headers presence:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `X-XSS-Protection: 1; mode=block`
   - Checks overall performance metrics

## 🔧 Test Configuration

### Environment Variables
```bash
TEST_URL=http://localhost:3000  # Application URL to test
```

### Test Parameters
```javascript
const config = {
  baseURL: process.env.TEST_URL || 'http://localhost:3000',
  timeout: 30000,              // 30 second timeout
  searchQuery: 'artificial intelligence trends 2024'
};
```

## 📊 Understanding Test Results

### Success Output Example
```
🚀 SevenSearch E2E Workflow Test Suite
==================================================
Testing URL: http://localhost:3000
Search Query: "artificial intelligence trends 2024"

🧪 Homepage Accessibility and Structure
✅ Homepage Accessibility and Structure - PASSED

🧪 Search API Endpoint Functionality  
✅ Search API Endpoint Functionality - PASSED
     searchId: search_1234567890_abc123, resultCount: 1

🧪 Streaming Search with Real-time Updates
  📡 Received streaming chunk 1: {"step":0,"type":"workflow_started"...
  📡 Received streaming chunk 2: {"step":1,"type":"enhancing_started"...
✅ Streaming Search with Real-time Updates - PASSED
     chunkCount: 5, streamingWorking: true

📈 OVERALL RESULTS: 6/6 tests passed
🎉 All tests passed! SevenSearch is working correctly
```

### Failure Indicators
- ❌ Failed tests show specific error messages
- ⚠️ Warnings indicate partial functionality
- 💥 Critical failures stop test execution

## 🐛 Troubleshooting

### Common Issues

#### 1. **Connection Refused**
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
**Solution**: Ensure the application is running on the specified port

#### 2. **Streaming Not Working**
```
Error: Only one chunk received - streaming may not be working
```
**Solution**: Check Edge Runtime configuration and Response headers

#### 3. **Rate Limiting Not Active**
```
ℹ️ Rate limiting not triggered in light test (normal)
```
**Solution**: This is often normal - rate limits may not trigger with light testing

#### 4. **Security Headers Missing**
```
securityHeaderCount: 0
```
**Solution**: Check middleware.ts configuration and deployment settings

### Debug Mode
For detailed debugging, modify the test script:

```javascript
// Add more verbose logging
const DEBUG = true;

// Increase timeouts for slow environments
const config = {
  timeout: 60000,  // 60 seconds
  // ...
};
```

## 🎯 Advanced Testing

### Custom Test Scenarios

#### Testing Different Search Queries
```bash
# Modify the search query in the test script
sed -i 's/artificial intelligence trends 2024/your custom query/' scripts/run-e2e-workflow-test.js
npm run test:e2e
```

#### Load Testing Rate Limits
```javascript
// In the test script, increase request count
const requests = Array(25).fill().map((_, i) => /* ... */);
```

#### Testing Edge Cases
```javascript
// Test empty queries, special characters, very long queries
const testQueries = [
  '',
  'query with "special" characters & symbols',
  'a'.repeat(1000), // very long query
];
```

## 🔄 Continuous Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run build
      - run: npm start &
      - run: sleep 10  # Wait for server
      - run: npm run test:e2e:dev
```

### Vercel Preview Testing
```yaml
# Test against Vercel preview deployments
- run: npm run test:e2e:prod
  env:
    TEST_URL: ${{ steps.vercel.outputs.preview-url }}
```

## 📈 Monitoring & Analytics

### Performance Benchmarks
- Homepage load: < 3 seconds
- API response: < 2 seconds  
- Streaming chunks: 3-5 chunks in < 10 seconds
- Rate limiting: Triggers after 20 search requests/minute

### Success Criteria
✅ All 6 core tests pass  
✅ Streaming delivers multiple chunks  
✅ Rate limiting protects endpoints  
✅ Security headers present  
✅ Performance within benchmarks  

## 🤝 Contributing

When adding new features to SevenSearch:

1. **Add corresponding tests** to the E2E suite
2. **Update test documentation** with new scenarios
3. **Verify tests pass** in both dev and production
4. **Update benchmarks** if performance characteristics change

## 📞 Support

If tests fail unexpectedly:

1. Check the [troubleshooting section](#-troubleshooting)
2. Review application logs for errors
3. Verify environment configuration
4. Test individual components manually
5. Open an issue with test output and environment details

---

**Happy Testing! 🎉**

This E2E test suite ensures SevenSearch delivers a reliable, fast, and secure search experience for all users.