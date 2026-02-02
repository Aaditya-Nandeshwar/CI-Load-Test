# K6 Load Testing Suite

A comprehensive k6 load testing suite with best practices for performance testing.

## Test Types

### 1. **Smoke Test** (`smoke_test_k6.js`)
**Purpose:** Quick validation that the system works under minimal load.

**When to use:**
- Before running larger tests
- After deployments to verify basic functionality
- As part of CI/CD pipeline

**Configuration:**
- 20 virtual users
- 1 minute duration
- Strict thresholds (<1% failure rate)

**Run:**
```bash
k6 run smoke_test_k6.js
```

---

### 2. **Average Load Test** (`avg_load_test_k6.js`)
**Purpose:** Test system performance under typical/expected traffic.

**When to use:**
- Verify system handles normal day-to-day traffic
- Establish baseline performance metrics
- Validate SLAs are met under normal conditions

**Configuration:**
- 100 virtual users (adjust based on your typical traffic)
- 2m ramp-up, 5m sustained, 2m ramp-down
- Moderate thresholds

**Run:**
```bash
k6 run avg_load_test_k6.js
```

---

### 3. **Stress Test** (`stress_test_k6.js`)
**Purpose:** Find the breaking point by gradually increasing load beyond normal capacity.

**When to use:**
- Identify maximum capacity
- Find bottlenecks and failure points
- Understand degradation patterns

**Configuration:**
- 200 virtual users (beyond normal capacity)
- 1m ramp-up, 3m sustained, 1m ramp-down
- Standard thresholds

**Run:**
```bash
k6 run stress_test_k6.js
```

---

### 4. **Spike Test** (`spike_test_k6.js`)
**Purpose:** Test system behavior under sudden, dramatic traffic increases.

**When to use:**
- Verify auto-scaling works correctly
- Test circuit breakers and rate limiting
- Simulate viral events or flash sales

**Configuration:**
- Baseline (100) → Spike (2000) → Baseline (100)
- Multiple stages to simulate realistic spike pattern
- Relaxed thresholds (allows 503s during spike)

**Run:**
```bash
k6 run spike_test_k6.js
```

---

### 5. **Soak Test** (`soak_test_k6.js`)
**Purpose:** Detect memory leaks, resource exhaustion, and performance degradation over time.

**When to use:**
- Verify system stability over extended periods
- Find memory leaks
- Check for resource exhaustion (file handles, connections, etc.)

**Configuration:**
- 100 virtual users
- 2.5m ramp-up, **15m sustained**, 2.5m ramp-down
- Slightly relaxed thresholds for long duration

**Run:**
```bash
k6 run soak_test_k6.js
```

---

## Common Improvements Across All Tests

### ✅ What's Better:

1. **Better tagging** - Uses `endpoint` tags instead of `name` for clearer metrics
2. **Timeouts added** - Prevents hanging requests (10-20s based on test type)
3. **Enhanced checks** - Validates response body exists, not just status codes
4. **Overall thresholds** - Added general `http_req_duration` that applies to all requests
5. **Per-endpoint metrics** - Track performance per endpoint separately
6. **Configurable think time** - Use `-e THINK_TIME=2` to adjust
7. **Timestamped reports** - Output files won't overwrite each other
8. **Pretty JSON** - Formatted for readability
9. **Better comments** - Clear documentation
10. **Consistent structure** - All tests follow the same pattern

---

## Environment Variables

All tests support these environment variables:

```bash
# Custom target URL
k6 run -e TARGET_URL=https://api.example.com smoke_test_k6.js

# Custom think time (seconds between requests)
k6 run -e THINK_TIME=2 avg_load_test_k6.js

# Combined
k6 run -e TARGET_URL=https://api.example.com -e THINK_TIME=0.5 stress_test_k6.js
```

---

## Recommended Testing Order

1. **Smoke Test** - Verify system works (1 min)
2. **Average Load Test** - Establish baseline (9 min)
3. **Stress Test** - Find limits (5 min)
4. **Spike Test** - Test elasticity (5 min)
5. **Soak Test** - Check stability (20 min)

---

## Interpreting Results

### Key Metrics to Watch:

- **`http_req_duration`** - Response time (lower is better)
  - p(90) = 90% of requests faster than this
  - p(95) = 95% of requests faster than this
  - p(99) = 99% of requests faster than this

- **`http_req_failed`** - Failure rate (lower is better)
  - Should be < 5% for most tests
  - May be higher during spike tests (system under extreme stress)

- **`checks`** - Validation success rate
  - Should be > 95% for most tests

### What to Look For:

- **Smoke Test**: All checks should pass, fast response times
- **Average Load**: Consistent performance within SLA thresholds
- **Stress Test**: Where does performance start degrading?
- **Spike Test**: Does system recover after spike? Are there cascading failures?
- **Soak Test**: Does performance degrade over time? Memory leaks?

---

## Tips

- Start with smoke test before running expensive/long tests
- Adjust VU counts based on your expected traffic
- Monitor server metrics (CPU, memory, connections) alongside k6 results
- Use timestamped reports to compare results over time
- Run tests from multiple regions to test geographic performance

---

## Output Files

Each test generates:
- `{test-type}-summary-{timestamp}.html` - Visual HTML report
- `{test-type}-summary-{timestamp}.json` - Machine-readable results
- Console output with color-coded summary