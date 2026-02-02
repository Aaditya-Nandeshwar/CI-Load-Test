import http from 'k6/http';
import { sleep, check } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// Configuration
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';
const THINK_TIME = __ENV.THINK_TIME || 1;

export const options = {
  vus: 20,              // 20 virtual users - minimal load to verify system works
  duration: '1m',       // Short 1-minute test for quick validation
  thresholds: {
    // Overall performance thresholds
    'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
    'http_req_failed': ['rate<0.01'], // Stricter for smoke tests - less than 1% failure
    
    // Per-endpoint thresholds
    'http_req_duration{endpoint:foo}': ['p(95)<1000'],
    'http_req_duration{endpoint:bar}': ['p(95)<1000'],
    
    // Success rate per endpoint (smoke tests should have very high success)
    'checks{endpoint:foo}': ['rate>0.99'],
    'checks{endpoint:bar}': ['rate>0.99'],
  },
};

export default function() {
  // Test /foo endpoint
  const fooRes = http.get(`${BASE_URL}/foo`, {
    tags: { endpoint: 'foo' },
    timeout: '10s',
  });
  
  check(fooRes, {
    'foo: status is 200': (r) => r.status === 200,
    'foo: response time < 1000ms': (r) => r.timings.duration < 1000,
    'foo: has response body': (r) => r.body && r.body.length > 0,
  }, { endpoint: 'foo' });
  
  sleep(THINK_TIME);
  
  // Test /bar endpoint
  const barRes = http.get(`${BASE_URL}/bar`, {
    tags: { endpoint: 'bar' },
    timeout: '10s',
  });
  
  check(barRes, {
    'bar: status is 200': (r) => r.status === 200,
    'bar: response time < 1000ms': (r) => r.timings.duration < 1000,
    'bar: has response body': (r) => r.body && r.body.length > 0,
  }, { endpoint: 'bar' });
  
  sleep(THINK_TIME);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return {
    [`smoke-test-summary-${timestamp}.html`]: htmlReport(data),
    [`smoke-test-summary-${timestamp}.json`]: JSON.stringify(data, null, 2),
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
  };
}