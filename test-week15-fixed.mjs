/**
 * Test script for Phase 7 Week 15 - Model Usage and Alerts
 * 
 * This script tests:
 * 1. Daily usage API
 * 2. Monthly cost API
 * 3. Quota alerts API
 * 4. Check quota endpoint
 */

import dotenv from 'dotenv';
dotenv.config();

async function testAPI() {
  const baseURL = 'http://localhost:3000';
  
  console.log('Testing Phase 7 Week 15 APIs...\n');
  
  // First test status endpoint
  console.log('0. Testing /api/status');
  try {
    const response = await fetch(`${baseURL}/api/status`);
    const data = await response.json();
    console.log(`   ✓ Status: ${response.status}`);
    console.log(`   ✓ Service: ${data.service}, Status: ${data.status}`);
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
    console.log('   Cannot connect to server, aborting tests...');
    return;
  }
  
  const headers = {};
  if (process.env.API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    console.log(`   ✓ Using API_TOKEN from .env\n`);
  } else {
    console.log(`   ⚠ No API_TOKEN configured, skipping auth\n`);
  }
  
  // Test 1: Daily usage
  console.log('1. Testing /api/models/daily-usage');
  try {
    const response = await fetch(`${baseURL}/api/models/daily-usage`, { headers });
    const data = await response.json();
    console.log(`   ✓ Status: ${response.status}`);
    console.log(`   ✓ Records: ${data.dailyUsage?.length || 0}`);
    if (data.dailyUsage?.length > 0) {
      console.log(`   ✓ Sample: ${JSON.stringify(data.dailyUsage[0], null, 2).substring(0, 100)}...`);
    }
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }
  
  // Test 2: Monthly cost
  console.log('\n2. Testing /api/models/monthly-cost');
  try {
    const response = await fetch(`${baseURL}/api/models/monthly-cost`, { headers });
    const data = await response.json();
    console.log(`   ✓ Status: ${response.status}`);
    console.log(`   ✓ Records: ${data.monthlyCost?.length || 0}`);
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }
  
  // Test 3: Quota alerts
  console.log('\n3. Testing /api/models/quota-alerts');
  try {
    const response = await fetch(`${baseURL}/api/models/quota-alerts`, { headers });
    const data = await response.json();
    console.log(`   ✓ Status: ${response.status}`);
    console.log(`   ✓ Alerts: ${data.alerts?.length || 0}`);
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }
  
  // Test 4: Check quota
  console.log('\n4. Testing /api/models/check-quota');
  try {
    const response = await fetch(`${baseURL}/api/models/check-quota`, { headers });
    const data = await response.json();
    console.log(`   ✓ Status: ${response.status}`);
    console.log(`   ✓ Result: ${JSON.stringify(data)}`);
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }
  
  console.log('\n✅ All tests completed!');
}

testAPI();
