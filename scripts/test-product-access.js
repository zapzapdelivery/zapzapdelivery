// Configuration
const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/produtos`;

async function testProductAccess() {
  console.log('--- Testing Product Access Isolation ---');

  // Test 1: No Token (Should fail)
  console.log('\nTest 1: Request without token');
  try {
    const res = await fetch(API_URL);
    console.log(`Status: ${res.status}`);
    if (res.status === 401) {
      console.log('PASS: Access denied without token');
    } else {
      console.log('FAIL: Expected 401, got ' + res.status);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }

  // Test 2: Invalid Token (Should fail)
  console.log('\nTest 2: Request with invalid token');
  try {
    const res = await fetch(API_URL, {
      headers: { Authorization: 'Bearer invalid-token' }
    });
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    if (res.status === 401 && data.error === 'Invalid token') {
      console.log('PASS: Access denied with invalid token');
    } else {
      console.log('FAIL: Expected 401/Invalid token, got ' + res.status);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  console.log('\n--- Test Completed ---');
}

testProductAccess();
