# How to Access Endpoints in KinD Cluster

## Overview

The ingress controller is deployed as a **NodePort** service on port **30080**. The ingress routes traffic based on paths:
- `/foo` → `foo-echo` service (returns "foo")
- `/bar` → `bar-echo` service (returns "bar")

## Access Methods

### Method 1: Direct Access via NodePort (Recommended)

Since the ingress controller service uses NodePort 30080, and the KinD cluster maps this port to the host, you can access the endpoints directly:

```bash
# Access foo endpoint
curl http://localhost:30080/foo
# Expected output: foo

# Access bar endpoint
curl http://localhost:30080/bar
# Expected output: bar
```

### Method 2: Port Forward to Ingress Controller Service

If direct access doesn't work, you can use `kubectl port-forward`:

```bash
# Forward ingress controller service to local port
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80

# Then access via the forwarded port
curl http://localhost:8080/foo
curl http://localhost:8080/bar
```

### Method 3: Access via KinD Node IP

You can also access via the KinD node's IP address:

```bash
# Get the KinD node IP
docker inspect ci-loadtest-control-plane | grep IPAddress

# Access via node IP (replace <NODE_IP> with actual IP)
curl http://<NODE_IP>:30080/foo
curl http://<NODE_IP>:30080/bar
```

### Method 4: Exec into a Pod and Test

You can exec into any pod and test from inside the cluster:

```bash
# Create a temporary pod
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- sh

# Inside the pod, test the endpoints
curl http://ingress-nginx-controller.ingress-nginx.svc.cluster.local/foo
curl http://ingress-nginx-controller.ingress-nginx.svc.cluster.local/bar
```

## Verification Steps

1. **Check ingress controller is running:**
   ```bash
   kubectl get pods -n ingress-nginx
   kubectl get svc -n ingress-nginx
   ```

2. **Check ingress resource:**
   ```bash
   kubectl get ingress echo-ingress
   kubectl describe ingress echo-ingress
   ```

3. **Check foo/bar services:**
   ```bash
   kubectl get pods -l app=foo-echo
   kubectl get pods -l app=bar-echo
   kubectl get svc foo-echo bar-echo
   ```

4. **Test endpoints:**
   ```bash
   curl -v http://localhost:30080/foo
   curl -v http://localhost:30080/bar
   ```

## Troubleshooting

### Port 30080 not accessible

If you can't access port 30080, check:

1. **Verify port mapping in KinD:**
   ```bash
   docker ps | grep ci-loadtest
   docker port ci-loadtest-control-plane
   ```

2. **Check if ingress controller service is NodePort:**
   ```bash
   kubectl get svc -n ingress-nginx ingress-nginx-controller
   # Should show TYPE: NodePort and PORT(S): 80:30080/TCP
   ```

3. **Check ingress controller logs:**
   ```bash
   kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
   ```

### 404 Not Found

If you get 404 errors:

1. **Verify ingress routing:**
   ```bash
   kubectl describe ingress echo-ingress
   # Check that paths /foo and /bar are configured
   ```

2. **Check backend services:**
   ```bash
   kubectl get endpoints foo-echo bar-echo
   # Should show endpoints with IPs
   ```

3. **Test services directly (bypass ingress):**
   ```bash
   kubectl port-forward svc/foo-echo 8080:80
   curl http://localhost:8080
   # Should return "foo"
   ```

### Connection Refused

If you get connection refused:

1. **Check if ingress controller pods are running:**
   ```bash
   kubectl get pods -n ingress-nginx
   # All pods should be Running and Ready
   ```

2. **Check ingress controller service:**
   ```bash
   kubectl get svc -n ingress-nginx ingress-nginx-controller
   # Should have an EXTERNAL-IP or be accessible via NodePort
   ```

## Configuration Summary

- **Ingress Controller**: NGINX Ingress Controller v1.14.1
- **Service Type**: NodePort
- **NodePort**: 30080
- **Ingress Class**: nginx
- **Routing**: Path-based (`/foo` and `/bar`)
- **Backend Services**: 
  - `foo-echo` on port 80 → returns "foo"
  - `bar-echo` on port 80 → returns "bar"
