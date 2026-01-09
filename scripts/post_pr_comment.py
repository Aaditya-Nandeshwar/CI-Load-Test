#!/usr/bin/env python3
"""Post k6 load test results as a PR comment."""
import argparse
import json
import os
import sys
from typing import Any, Dict
import requests


def load_summary(path: str) -> Dict[str, Any]:
    """Load k6 summary JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def format_duration(ms: float) -> str:
    """Format duration from milliseconds to human-readable format."""
    if ms < 1000:
        return f"{ms:.0f}ms"
    elif ms < 60000:
        return f"{ms/1000:.1f}s"
    else:
        minutes = int(ms / 60000)
        seconds = (ms % 60000) / 1000
        return f"{minutes}m {seconds:.0f}s"


def get_threshold_status(metrics: Dict[str, Any]) -> tuple[int, int]:
    """Get count of passed and failed thresholds."""
    passed = 0
    failed = 0
    
    for metric_name, metric_data in metrics.items():
        thresholds = metric_data.get("thresholds", {})
        for threshold_name, threshold_data in thresholds.items():
            if threshold_data.get("ok"):
                passed += 1
            else:
                failed += 1
    
    return passed, failed


def format_k6_comment(summary: Dict[str, Any], test_type: str = "Load Test") -> str:
    """Format k6 summary as a comprehensive Markdown comment."""
    lines = []
    lines.append(f"## 🚀 K6 {test_type} Results")
    lines.append("")
    
    metrics = summary.get("metrics", {})
    state = summary.get("state", {})
    checks = summary.get("root_group", {}).get("checks", [])
    
    # Test duration
    duration_ms = state.get("testRunDurationMs", 0)
    
    # Virtual users
    vus_metric = metrics.get("vus", {}).get("values", {})
    vus_max_metric = metrics.get("vus_max", {}).get("values", {})
    vus = vus_metric.get("value", 0)
    vus_max = vus_max_metric.get("max", vus)
    
    # Request metrics
    http_reqs = metrics.get("http_reqs", {}).get("values", {})
    total_requests = http_reqs.get("count", 0)
    req_per_s = http_reqs.get("rate", 0.0)
    
    # Iterations
    iterations = metrics.get("iterations", {}).get("values", {})
    total_iterations = iterations.get("count", 0)
    iterations_per_s = iterations.get("rate", 0.0)
    
    # Error rate
    http_req_failed = metrics.get("http_req_failed", {}).get("values", {})
    error_rate = http_req_failed.get("rate", 0.0) * 100.0
    failed_requests = http_req_failed.get("passes", 0)  # k6 counts failed as "passes" in the rate metric
    
    # Duration metrics
    http_req_duration = metrics.get("http_req_duration", {}).get("values", {})
    latency_avg_ms = http_req_duration.get("avg", 0.0)
    latency_p90_ms = http_req_duration.get("p(90)", 0.0)
    latency_p95_ms = http_req_duration.get("p(95)", 0.0)
    latency_p99_ms = http_req_duration.get("p(99)", 0.0)
    
    # Checks
    checks_metric = metrics.get("checks", {}).get("values", {})
    checks_passed = checks_metric.get("passes", 0)
    checks_failed = checks_metric.get("fails", 0)
    checks_total = checks_passed + checks_failed
    checks_pass_rate = (checks_passed / checks_total * 100.0) if checks_total > 0 else 0.0
    
    # Thresholds
    thresholds_passed, thresholds_failed = get_threshold_status(metrics)
    thresholds_total = thresholds_passed + thresholds_failed
    
    # Data transfer
    data_sent = metrics.get("data_sent", {}).get("values", {})
    data_received = metrics.get("data_received", {}).get("values", {})
    data_sent_bytes = data_sent.get("count", 0)
    data_received_bytes = data_received.get("count", 0)
    
    # Overall status
    all_passed = error_rate < 5.0 and checks_failed == 0 and thresholds_failed == 0
    
    # Test Configuration Section
    lines.append("### 📊 Test Configuration")
    lines.append("| Parameter | Value |")
    lines.append("|-----------|-------|")
    lines.append(f"| **Duration** | {format_duration(duration_ms)} |")
    lines.append(f"| **Virtual Users** | {vus_max} |")
    lines.append(f"| **Total Iterations** | {total_iterations:,} ({iterations_per_s:.2f}/s) |")
    lines.append("")
    
    # Overall Results Section
    status_emoji = "✅" if all_passed else "❌"
    lines.append(f"### {status_emoji} Overall Results")
    lines.append("| Metric | Value |")
    lines.append("|--------|-------|")
    lines.append(f"| **Total Requests** | {total_requests:,} |")
    lines.append(f"| **Requests/sec** | {req_per_s:.2f} |")
    
    error_emoji = "✅" if error_rate < 5.0 else "⚠️"
    lines.append(f"| **Error Rate** | {error_emoji} {error_rate:.2f}% ({failed_requests}/{total_requests}) |")
    
    checks_emoji = "✅" if checks_failed == 0 else "❌"
    lines.append(f"| **Checks Passed** | {checks_emoji} {checks_pass_rate:.1f}% ({checks_passed}/{checks_total}) |")
    
    if thresholds_total > 0:
        thresholds_emoji = "✅" if thresholds_failed == 0 else "❌"
        lines.append(f"| **Thresholds Passed** | {thresholds_emoji} {thresholds_passed}/{thresholds_total} |")
    
    lines.append(f"| **Data Sent** | {data_sent_bytes / 1024 / 1024:.2f} MB |")
    lines.append(f"| **Data Received** | {data_received_bytes / 1024 / 1024:.2f} MB |")
    lines.append("")
    
    # Latency Metrics Section
    lines.append("### ⚡ Latency Metrics")
    lines.append("| Percentile | Response Time |")
    lines.append("|------------|---------------|")
    lines.append(f"| **Average** | {latency_avg_ms:.2f} ms |")
    lines.append(f"| **P90** | {latency_p90_ms:.2f} ms |")
    lines.append(f"| **P95** | {latency_p95_ms:.2f} ms |")
    lines.append(f"| **P99** | {latency_p99_ms:.2f} ms |")
    lines.append("")
    
    # Per-Endpoint Metrics (if available)
    endpoint_metrics = {}
    for metric_name, metric_data in metrics.items():
        if "endpoint:" in metric_name and metric_name.startswith("http_req_duration"):
            endpoint = metric_name.split("endpoint:")[1].rstrip("}")
            values = metric_data.get("values", {})
            endpoint_metrics[endpoint] = {
                "avg": values.get("avg", 0.0),
                "p90": values.get("p(90)", 0.0),
                "p95": values.get("p(95)", 0.0),
                "p99": values.get("p(99)", 0.0),
            }
    
    if endpoint_metrics:
        lines.append("### 🎯 Per-Endpoint Performance")
        lines.append("| Endpoint | Avg (ms) | P90 (ms) | P95 (ms) | P99 (ms) |")
        lines.append("|----------|----------|----------|----------|----------|")
        for endpoint, values in sorted(endpoint_metrics.items()):
            lines.append(f"| **/{endpoint}** | {values['avg']:.2f} | {values['p90']:.2f} | {values['p95']:.2f} | {values['p99']:.2f} |")
        lines.append("")
    
    # Detailed Checks Section
    if checks:
        lines.append("### 📋 Detailed Check Results")
        lines.append("| Check Name | Status | Passed | Failed |")
        lines.append("|------------|--------|--------|--------|")
        for check in checks:
            check_name = check.get("name", "Unknown")
            passes = check.get("passes", 0)
            fails = check.get("fails", 0)
            status = "✅" if fails == 0 else "❌"
            lines.append(f"| {check_name} | {status} | {passes:,} | {fails:,} |")
        lines.append("")
    
    # Threshold Details (if any failed)
    if thresholds_failed > 0:
        lines.append("### ⚠️ Failed Thresholds")
        lines.append("| Metric | Threshold | Status |")
        lines.append("|--------|-----------|--------|")
        for metric_name, metric_data in metrics.items():
            thresholds = metric_data.get("thresholds", {})
            for threshold_name, threshold_data in thresholds.items():
                if not threshold_data.get("ok"):
                    lines.append(f"| {metric_name} | {threshold_name} | ❌ Failed |")
        lines.append("")
    
    # Final Summary
    if all_passed:
        lines.append("✅ **All tests passed successfully!**")
    else:
        lines.append("### ⚠️ Issues Detected")
        if error_rate >= 5.0:
            lines.append(f"- ❌ Error rate ({error_rate:.2f}%) exceeds threshold (5%)")
        if checks_failed > 0:
            lines.append(f"- ❌ {checks_failed} check(s) failed")
        if thresholds_failed > 0:
            lines.append(f"- ❌ {thresholds_failed} threshold(s) failed")
    
    return "\n".join(lines)


def determine_test_type(summary_path: str) -> str:
    """Determine test type from filename."""
    filename = os.path.basename(summary_path).lower()
    if "smoke" in filename:
        return "Smoke Test"
    elif "avg" in filename or "average" in filename:
        return "Average Load Test"
    elif "stress" in filename:
        return "Stress Test"
    elif "spike" in filename:
        return "Spike Test"
    elif "soak" in filename:
        return "Soak Test"
    return "Load Test"


def main() -> None:
    parser = argparse.ArgumentParser(description="Post k6 load test results as PR comment")
    parser.add_argument(
        "--summary-file",
        required=True,
        help="Path to k6 summary JSON file (e.g., smoke-test-summary.json)",
    )
    args = parser.parse_args()
    
    # Check required environment variables
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("❌ Error: GITHUB_TOKEN environment variable is not set", file=sys.stderr)
        sys.exit(1)
    
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if not event_path or not os.path.isfile(event_path):
        print("❌ Error: GITHUB_EVENT_PATH is not set or file not found", file=sys.stderr)
        sys.exit(1)
    
    # Check if summary file exists
    if not os.path.isfile(args.summary_file):
        print(f"❌ Error: Summary file not found: {args.summary_file}", file=sys.stderr)
        sys.exit(1)
    
    # Load GitHub event
    with open(event_path, "r", encoding="utf-8") as f:
        event = json.load(f)
    
    pr = event.get("pull_request")
    if not pr:
        print("❌ Error: This workflow is not running in the context of a pull_request event", file=sys.stderr)
        sys.exit(1)
    
    repo = event["repository"]["full_name"]
    pr_number = pr["number"]
    
    # Load and format summary
    summary = load_summary(args.summary_file)
    test_type = determine_test_type(args.summary_file)
    body = format_k6_comment(summary, test_type)
    
    # Post comment to PR
    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    
    response = requests.post(url, headers=headers, json={"body": body}, timeout=10)
    
    if response.status_code >= 300:
        print(f"❌ Failed to post PR comment: {response.status_code} {response.text}", file=sys.stderr)
        sys.exit(1)
    
    print(f"✅ Successfully posted {test_type} results to PR #{pr_number}")


if __name__ == "__main__":
    main()