#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-ci-loadtest}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the repository root directory (parent of scripts/)
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Debug: List current directory structure
echo "[setup_kind_cluster] Debugging directory structure..."
echo "[setup_kind_cluster] Current working directory: $(pwd)"
echo "[setup_kind_cluster] Repository root: ${REPO_ROOT}"
echo "[setup_kind_cluster] Script directory: ${SCRIPT_DIR}"
echo "[setup_kind_cluster] Listing repository root directory:"
ls -la "${REPO_ROOT}/" || echo "  Failed to list repo root"
echo "[setup_kind_cluster] Listing kind directory (if exists):"
ls -la "${REPO_ROOT}/kind/" 2>/dev/null || echo "  kind/ directory does not exist at ${REPO_ROOT}/kind/"
echo "[setup_kind_cluster] Searching for kind-config.yaml:"
find "${REPO_ROOT}" -name "kind-config.yaml" -type f 2>/dev/null || echo "  No kind-config.yaml found in repository"

# Try to find the config file in multiple locations
if [[ -n "${KIND_CONFIG_PATH:-}" ]]; then
  # Use explicitly provided path
  CONFIG_PATH="${KIND_CONFIG_PATH}"
elif [[ -f "${REPO_ROOT}/kind/kind-config.yaml" ]]; then
  # Try absolute path from repo root
  CONFIG_PATH="${REPO_ROOT}/kind/kind-config.yaml"
elif [[ -f "kind/kind-config.yaml" ]]; then
  # Try relative path from current directory (should work in GitHub Actions)
  CONFIG_PATH="kind/kind-config.yaml"
elif [[ -f "./kind/kind-config.yaml" ]]; then
  # Try explicit relative path
  CONFIG_PATH="./kind/kind-config.yaml"
else
  echo "[setup_kind_cluster] ERROR: Config file not found in any expected location"
  echo "[setup_kind_cluster] Current directory: $(pwd)"
  echo "[setup_kind_cluster] Repository root: ${REPO_ROOT}"
  echo "[setup_kind_cluster] Script directory: ${SCRIPT_DIR}"
  echo "[setup_kind_cluster] Tried paths:"
  echo "  - ${REPO_ROOT}/kind/kind-config.yaml"
  echo "  - kind/kind-config.yaml"
  echo "  - ./kind/kind-config.yaml"
  echo "[setup_kind_cluster] Listing kind directory:"
  ls -la "${REPO_ROOT}/kind/" 2>/dev/null || echo "  kind/ directory does not exist"
  exit 1
fi

KIND_CONFIG_PATH="${CONFIG_PATH}"
echo "[setup_kind_cluster] Creating KinD cluster '${CLUSTER_NAME}' using config '${KIND_CONFIG_PATH}'..."

if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  echo "[setup_kind_cluster] Cluster '${CLUSTER_NAME}' already exists, deleting to ensure clean state..."
  kind delete cluster --name "${CLUSTER_NAME}"
fi

kind create cluster --name "${CLUSTER_NAME}" --config "${KIND_CONFIG_PATH}"

echo "[setup_kind_cluster] KinD cluster '${CLUSTER_NAME}' is ready."

