import http from 'k6/http';
import { sleep, check } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// Configuration
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';
const THINK_TIME = __ENV.THINK_TIME || 1; // seconds between requests

export const options = {
  stages: [
    { duration: '1m', target: 200 },   // Ramp-up: 0 → 200 users over 1 minute
    { duration: '3m', target: 200 },   // Sustained load: 200 users for 3 minutes
    { duration: '1m', target: 0 },     // Ramp-down: 200 → 0 users over 1 minute
  ],
  thresholds: {
    // Overall performance thresholds
    'http_req_duration': ['p(90)<500', 'p(95)<1000', 'p(99)<2000'],
    'http_req_failed': ['rate<0.05'], // Less than 5% failure rate
    
    // Per-endpoint thresholds (more specific)
    'http_req_duration{endpoint:foo}': ['p(95)<500'],
    'http_req_duration{endpoint:bar}': ['p(95)<500'],
    
    // Success rate per endpoint
    'checks{endpoint:foo}': ['rate>0.95'],
    'checks{endpoint:bar}': ['rate>0.95'],
  },
};

export default function() {
  // Test /foo endpoint
  const fooRes = http.get(`${BASE_URL}/foo`, {
    tags: { endpoint: 'foo' },
    timeout: '10s', // Add timeout to prevent hanging requests
  });
  
  check(fooRes, {
    'foo: status is 200': (r) => r.status === 200,
    'foo: response time < 500ms': (r) => r.timings.duration < 500,
    'foo: has response body': (r) => r.body && r.body.length > 0,
  }, { endpoint: 'foo' }); // Tag checks for per-endpoint metrics
  
  sleep(THINK_TIME);
  
  // Test /bar endpoint
  const barRes = http.get(`${BASE_URL}/bar`, {
    tags: { endpoint: 'bar' },
    timeout: '10s',
  });
  
  check(barRes, {
    'bar: status is 200': (r) => r.status === 200,
    'bar: response time < 500ms': (r) => r.timings.duration < 500,
    'bar: has response body': (r) => r.body && r.body.length > 0,
  }, { endpoint: 'bar' });
  
  sleep(THINK_TIME);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return {
    [`stress-test-summary-${timestamp}.html`]: htmlReport(data),
    [`stress-test-summary-${timestamp}.json`]: JSON.stringify(data, null, 2), // Pretty print JSON
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
  };
}