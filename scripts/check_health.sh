#!/usr/bin/env bash
set -euo pipefail
export ENV="$1"
echo "[check_health] Waiting for foo-echo and bar-echo deployments to be available..."
kubectl rollout status deployment/foo-echo -n "${ENV}" --timeout=120s
kubectl rollout status deployment/bar-echo -n "${ENV}" --timeout=120s

echo "[check_health] Checking services..."
kubectl get svc foo-echo -n "${ENV}"
kubectl get svc bar-echo -n "${ENV}"

echo "[check_health] Waiting for ingress resource to be created..."
kubectl get ingress echo-ingress -n "${ENV}"

echo "[check_health] Probing HTTP endpoints via ingress..."

# Get the ingress controller service port (NodePort 8080)
INGRESS_PORT=8080

echo "[check_health] Testing /foo endpoint..."
foo_body=$(curl -sS --retry 5 --retry-delay 2 --max-time 5 "http://localhost:${INGRESS_PORT}/foo" || true)
if [[ "${foo_body}" != "foo" ]]; then
  echo "[check_health] ERROR: Expected 'foo' from /foo but got '${foo_body}'"
  exit 1
fi

echo "[check_health] Testing /bar endpoint..."
bar_body=$(curl -sS --retry 5 --retry-delay 2 --max-time 5 "http://localhost:${INGRESS_PORT}/bar" || true)
if [[ "${bar_body}" != "bar" ]]; then
  echo "[check_health] ERROR: Expected 'bar' from /bar but got '${bar_body}'"
  exit 1
fi

echo "[check_health] All checks passed."

