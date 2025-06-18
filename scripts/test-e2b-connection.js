// A simple script to test the E2B connection
const https = require('https');

const E2B_API_KEY = process.env.E2B_API_KEY || 'e2b_755d1e618d3be7c769c1a45961454cb010f687f2';

const options = {
  hostname: 'api.e2b.dev',
  port: 443,
  path: '/sandbox/templates',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${E2B_API_KEY}`,
    'Content-Type': 'application/json'
  }
};

console.log('Testing E2B connection with API key:', E2B_API_KEY);

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response status code:', res.statusCode);
    
    if (res.statusCode === 200) {
      console.log('E2B connection successful!');
      try {
        const parsedData = JSON.parse(data);
        console.log('Available templates:', parsedData.map(t => t.id).join(', '));
      } catch (e) {
        console.log('Could not parse response data:', e.message);
      }
    } else if (res.statusCode === 401) {
      console.error('Authentication failed. Invalid API key.');
    } else {
      console.error('Error connecting to E2B. Status code:', res.statusCode);
      try {
        console.error('Error details:', JSON.parse(data));
      } catch (e) {
        console.error('Response data:', data);
      }
    }
  });
});

req.on('error', (error) => {
  console.error('Error connecting to E2B:', error.message);
});

req.end();