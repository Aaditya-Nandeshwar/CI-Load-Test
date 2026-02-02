#!/usr/bin/env bash
set -euo pipefail

# Get the repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
export ENV="$1"

echo "[deploy_echo_services] creating ${ENV} namespace."
kubectl apply -k "${REPO_ROOT}/k8s/apps/overlays/env/namespace"
echo "[deploy_echo_services] ${ENV} namespace successfully created."

echo "[deploy_echo_services] Applying foo/bar echo deployments, services, and ingress..."

echo "[deploy_echo_services] creating foo deployment."
kubectl apply -k "${REPO_ROOT}/k8s/apps/overlays/env/${ENV}/services/foo"
echo "[deploy_echo_services] creating bar deployment."
kubectl apply -k "${REPO_ROOT}/k8s/apps/overlays/env/${ENV}/services/bar"
echo "[deploy_echo_services] creating ingress resource."
kubectl apply -k "${REPO_ROOT}/k8s/apps/overlays/env/${ENV}/ingress"
echo "[deploy_echo_services] Waiting for ingress IP allocation..."
sleep 90
echo "[deploy_echo_services] Ingress IP allocation completed"
echo "[deploy_echo_services] Exposing ingress svc on port 8080"

kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80 &

echo "[deploy_echo_services] foo & bar app is accessible now on localhost:8080/foo & localhost:8080/bar."


