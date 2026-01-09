import http from 'k6/http';
import { sleep, check } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// Configuration
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';
const THINK_TIME = __ENV.THINK_TIME || 1;

export const options = {
  stages: [
    { duration: '2.5m', target: 100 },   // Ramp-up: 0 → 100 users over 2.5m minutes
    { duration: '15m', target: 100 },  // Sustained load: 100 users for 15 minutes (soak test)
    { duration: '2.5m', target: 0 },     // Ramp-down: 100 → 0 users over 2.5m minutes
  ],
  thresholds: {
    // Overall performance thresholds - slightly relaxed for long duration
    'http_req_duration': ['p(90)<600', 'p(95)<1200', 'p(99)<3000'],
    'http_req_failed': ['rate<0.05'], // Less than 5% failure rate
    
    // Per-endpoint thresholds
    'http_req_duration{endpoint:foo}': ['p(95)<1000'],
    'http_req_duration{endpoint:bar}': ['p(95)<1000'],
    
    // Success rate per endpoint
    'checks{endpoint:foo}': ['rate>0.95'],
    'checks{endpoint:bar}': ['rate>0.95'],
    
    // Monitor for degradation - no more than 5% should take longer than 2s
    'http_req_duration': ['p(95)<2000'],
  },
};

export default function() {
  // Test /foo endpoint
  const fooRes = http.get(`${BASE_URL}/foo`, {
    tags: { endpoint: 'foo' },
    timeout: '15s', // Longer timeout for soak tests
  });
  
  check(fooRes, {
    'foo: status is 200': (r) => r.status === 200,
    'foo: response time < 1000ms': (r) => r.timings.duration < 1000,
    'foo: has response body': (r) => r.body && r.body.length > 0,
    'foo: no server errors': (r) => r.status < 500,
  }, { endpoint: 'foo' });
  
  sleep(THINK_TIME);
  
  // Test /bar endpoint
  const barRes = http.get(`${BASE_URL}/bar`, {
    tags: { endpoint: 'bar' },
    timeout: '15s',
  });
  
  check(barRes, {
    'bar: status is 200': (r) => r.status === 200,
    'bar: response time < 1000ms': (r) => r.timings.duration < 1000,
    'bar: has response body': (r) => r.body && r.body.length > 0,
    'bar: no server errors': (r) => r.status < 500,
  }, { endpoint: 'bar' });
  
  sleep(THINK_TIME);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return {
    [`soak-test-summary-${timestamp}.html`]: htmlReport(data),
    [`soak-test-summary-${timestamp}.json`]: JSON.stringify(data, null, 2),
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
  };
}