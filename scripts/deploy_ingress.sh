#!/usr/bin/env bash
set -euo pipefail

# Get the repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[deploy_ingress] Applying ingress-nginx namespace and controller manifests..."

kubectl apply -f "${REPO_ROOT}/k8s/ingress-controller/ingress-controller.yaml"

echo "[deploy_ingress] Waiting for ingress controller deployment to be ready..."
kubectl rollout status deployment/ingress-nginx-controller -n ingress-nginx --timeout=120s

echo "[deploy_ingress] Ingress controller is ready."


