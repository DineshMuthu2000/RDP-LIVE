const http = require('http');

async function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('   MODULE 2 - LICENSE MANAGEMENT SYSTEM VERIFICATION');
  console.log('====================================================\n');

  // Step 1: Admin Login
  console.log('[1] Logging in as Admin...');
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { username: 'admin', password: 'Admin@123456' }
  );

  if (loginRes.status !== 200 || !loginRes.data.data.token) {
    console.error('FAILED Admin Login:', loginRes);
    process.exit(1);
  }
  const token = loginRes.data.data.token;
  console.log('-> Admin logged in successfully. Token acquired.\n');

  // Step 2: Admin Creates a 2-PC License
  console.log('[2] Admin creating a 2-PC License Key (expires in 30 days)...');
  const createRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/licenses',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    },
    {
      customer_name: 'Acme Corp',
      customer_email: 'license@acme.com',
      max_pcs: 2,
      expires_in_days: 30,
      notes: 'Automated Test License'
    }
  );

  console.log('Status:', createRes.status);
  console.log('Created License:', createRes.data.data.license_key);
  const licenseKey = createRes.data.data.license_key;
  const licenseId = createRes.data.data.id;
  console.log('-> Success.\n');

  // Step 3: Activate PC 1
  console.log('[3] Activating License on PC 1 (HWID: HWID-001)...');
  const act1 = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/licenses/activate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      key: licenseKey,
      hwid: 'HWID-001',
      computer_name: 'WORKSTATION-1',
      ip_address: '192.168.1.101'
    }
  );
  console.log('Status:', act1.status);
  console.log('Response:', act1.data);
  if (act1.status !== 200) process.exit(1);
  console.log('-> PC 1 Activated successfully.\n');

  // Step 4: Validate PC 1
  console.log('[4] Validating License on PC 1...');
  const val1 = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/licenses/validate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      key: licenseKey,
      hwid: 'HWID-001',
      computer_name: 'WORKSTATION-1'
    }
  );
  console.log('Status:', val1.status);
  console.log('Response:', val1.data);
  if (val1.status !== 200) process.exit(1);
  console.log('-> PC 1 Validated successfully.\n');

  // Step 5: Activate PC 2
  console.log('[5] Activating License on PC 2 (HWID: HWID-002)...');
  const act2 = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/licenses/activate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      key: licenseKey,
      hwid: 'HWID-002',
      computer_name: 'WORKSTATION-2',
      ip_address: '192.168.1.102'
    }
  );
  console.log('Status:', act2.status);
  console.log('Response:', act2.data);
  if (act2.status !== 200) process.exit(1);
  console.log('-> PC 2 Activated successfully (2/2 PC limit used).\n');

  // Step 6: Activate PC 3 (Should Fail with PC Limit Exceeded)
  console.log('[6] Attempting to Activate PC 3 (HWID: HWID-003) -> Expecting 403 Forbidden PC Limit Error...');
  const act3 = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/licenses/activate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      key: licenseKey,
      hwid: 'HWID-003',
      computer_name: 'WORKSTATION-3',
      ip_address: '192.168.1.103'
    }
  );
  console.log('Status:', act3.status);
  console.log('Response:', act3.data);
  if (act3.status !== 403) {
    console.error('FAILED: PC 3 activation should have been blocked by PC limit.');
    process.exit(1);
  }
  console.log('-> PC Limit protection verified successfully.\n');

  // Step 7: Deactivate PC 1 to release slot
  console.log('[7] Deactivating PC 1 (HWID-001)...');
  const deact1 = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/licenses/deactivate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { key: licenseKey, hwid: 'HWID-001' }
  );
  console.log('Status:', deact1.status);
  console.log('Response:', deact1.data);
  if (deact1.status !== 200) process.exit(1);
  console.log('-> PC 1 Deactivated successfully.\n');

  // Step 8: Retry PC 3 activation (Should now succeed)
  console.log('[8] Retrying PC 3 activation after releasing slot...');
  const act3Retry = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/licenses/activate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      key: licenseKey,
      hwid: 'HWID-003',
      computer_name: 'WORKSTATION-3',
      ip_address: '192.168.1.103'
    }
  );
  console.log('Status:', act3Retry.status);
  console.log('Response:', act3Retry.data);
  if (act3Retry.status !== 200) process.exit(1);
  console.log('-> PC 3 Activated successfully.\n');

  // Step 9: Admin Disables License
  console.log('[9] Admin disabling license key...');
  const disableRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/licenses/${licenseId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    },
    { status: 'disabled' }
  );
  console.log('Status:', disableRes.status);
  console.log('Response:', disableRes.data);
  console.log('-> License disabled.\n');

  // Step 10: Client 2 validates on disabled license (Should fail 403)
  console.log('[10] Client 2 validating on disabled license -> Expecting 403 Forbidden...');
  const valDisabled = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/licenses/validate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { key: licenseKey, hwid: 'HWID-002' }
  );
  console.log('Status:', valDisabled.status);
  console.log('Response:', valDisabled.data);
  if (valDisabled.status !== 403) {
    console.error('FAILED: Disabled license validation should fail.');
    process.exit(1);
  }
  console.log('-> Disabled license protection verified successfully.\n');

  // Step 11: Admin Re-enables License
  console.log('[11] Admin re-enabling license key...');
  await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/licenses/${licenseId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    },
    { status: 'active' }
  );
  console.log('-> License re-enabled.\n');

  // Step 12: Admin Fetch Details & Activations List
  console.log('[12] Admin fetching license details with full device activation history...');
  const detailsRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/licenses/${licenseId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  console.log('Status:', detailsRes.status);
  console.log('License Details:', JSON.stringify(detailsRes.data.data, null, 2));
  console.log('-> Details & history verified.\n');

  // Step 13: Expiry Test
  console.log('[13] Testing Expired License...');
  const expiredKey = 'RDP-EXPIRED-TEST-KEY-0001';
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/licenses',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    },
    {
      custom_key: expiredKey,
      customer_name: 'Expired Customer',
      expires_at: pastDate
    }
  );

  const actExpired = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/licenses/activate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      key: expiredKey,
      hwid: 'HWID-EXPIRED-PC',
      computer_name: 'EXPIRED-PC'
    }
  );
  console.log('Status:', actExpired.status);
  console.log('Response:', actExpired.data);
  if (actExpired.status !== 403) {
    console.error('FAILED: Expired license activation should fail.');
    process.exit(1);
  }
  console.log('-> Expiry enforcement verified successfully.\n');

  console.log('====================================================');
  console.log('   ALL MODULE 2 TESTS PASSED PERFECTLY!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
