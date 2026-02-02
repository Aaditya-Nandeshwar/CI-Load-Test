import http from 'k6/http';
import { sleep, check } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// Configuration
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';
const THINK_TIME = __ENV.THINK_TIME || 1;

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp-up: 0 → 100 users over 2 minutes
    { duration: '5m', target: 100 },   // Sustained load: 100 users for 5 minutes (average load)
    { duration: '2m', target: 0 },     // Ramp-down: 100 → 0 users over 2 minutes
  ],
  thresholds: {
    // Overall performance thresholds
    'http_req_duration': ['p(90)<500', 'p(95)<1000', 'p(99)<2000'],
    'http_req_failed': ['rate<0.05'], // Less than 5% failure rate
    
    // Per-endpoint thresholds
    'http_req_duration{endpoint:foo}': ['p(95)<800'],
    'http_req_duration{endpoint:bar}': ['p(95)<800'],
    
    // Success rate per endpoint
    'checks{endpoint:foo}': ['rate>0.95'],
    'checks{endpoint:bar}': ['rate>0.95'],
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
    'foo: response time < 800ms': (r) => r.timings.duration < 800,
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
    'bar: response time < 800ms': (r) => r.timings.duration < 800,
    'bar: has response body': (r) => r.body && r.body.length > 0,
  }, { endpoint: 'bar' });
  
  sleep(THINK_TIME);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return {
    [`avg_load-test-summary-${timestamp}.html`]: htmlReport(data),
    [`avg_load-test-summary-${timestamp}.json`]: JSON.stringify(data, null, 2),
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
  };
}