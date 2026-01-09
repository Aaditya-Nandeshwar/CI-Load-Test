import http from 'k6/http';
import { sleep, check } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// Configuration
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';
const THINK_TIME = __ENV.THINK_TIME || 1;

export const options = {
  stages: [
    { duration: '10s', target: 100 },   // Baseline: ramp to 100 users
    { duration: '30s', target: 100 },   // Stay at baseline
    { duration: '1m', target: 2000 },   // SPIKE: rapid increase to 2000 users
    { duration: '1m', target: 2000 },   // Hold at peak
    { duration: '1m', target: 100 },    // Quick drop back to baseline
    { duration: '30s', target: 100 },   // Recover at baseline
    { duration: '10s', target: 0 },     // Ramp down
  ],
  thresholds: {
    // More relaxed thresholds for spike test - system may struggle during spike
    'http_req_duration': ['p(90)<2000', 'p(95)<3000'],
    'http_req_failed': ['rate<0.10'], // Allow up to 10% failures during spike
    
    // Per-endpoint thresholds
    'http_req_duration{endpoint:foo}': ['p(95)<3000'],
    'http_req_duration{endpoint:bar}': ['p(95)<3000'],
    
    // Success rate per endpoint - relaxed for spike conditions
    'checks{endpoint:foo}': ['rate>0.85'],
    'checks{endpoint:bar}': ['rate>0.85'],
  },
};

export default function() {
  // Test /foo endpoint
  const fooRes = http.get(`${BASE_URL}/foo`, {
    tags: { endpoint: 'foo' },
    timeout: '20s', // Longer timeout for spike conditions
  });
  
  check(fooRes, {
    'foo: status is 2xx or 503': (r) => (r.status >= 200 && r.status < 300) || r.status === 503,
    'foo: response received': (r) => r.status !== 0,
    'foo: response time < 5000ms': (r) => r.timings.duration < 5000,
  }, { endpoint: 'foo' });
  
  sleep(THINK_TIME);
  
  // Test /bar endpoint
  const barRes = http.get(`${BASE_URL}/bar`, {
    tags: { endpoint: 'bar' },
    timeout: '20s',
  });
  
  check(barRes, {
    'bar: status is 2xx or 503': (r) => (r.status >= 200 && r.status < 300) || r.status === 503,
    'bar: response received': (r) => r.status !== 0,
    'bar: response time < 5000ms': (r) => r.timings.duration < 5000,
  }, { endpoint: 'bar' });
  
  sleep(THINK_TIME);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return {
    [`spike-test-summary-${timestamp}.html`]: htmlReport(data),
    [`spike-test-summary-${timestamp}.json`]: JSON.stringify(data, null, 2),
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
  };
}