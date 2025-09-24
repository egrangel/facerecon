const fs = require('fs');

async function testCleanupEndpoint() {
  const apiUrl = 'http://192.168.1.2:3001/api/v1';

  console.log('Testing stream cleanup endpoint...');

  try {
    // Test with some example session IDs
    const testSessionIds = ['test-session-1', 'test-session-2', 'non-existent-session'];

    // Test JSON payload
    console.log('\n=== Testing JSON payload ===');
    const jsonResponse = await fetch(`${apiUrl}/streams/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionIds: testSessionIds }),
    });

    const jsonResult = await jsonResponse.json();
    console.log('JSON Response:', jsonResult);

    // Test FormData payload (like sendBeacon)
    console.log('\n=== Testing FormData payload (sendBeacon simulation) ===');
    const formData = new FormData();
    formData.append('sessionIds', testSessionIds.join(','));

    const formResponse = await fetch(`${apiUrl}/streams/cleanup`, {
      method: 'POST',
      body: formData,
    });

    const formResult = await formResponse.json();
    console.log('FormData Response:', formResult);

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Only run if backend is available
testCleanupEndpoint();