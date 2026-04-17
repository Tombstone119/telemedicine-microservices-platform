#!/usr/bin/env bash
# Deploy the full telemedicine platform to Kubernetes.
# Usage: bash k8s/deploy.sh [--delete]
set -euo pipefail

NAMESPACE="telemedicine"
ACTION="${1:-apply}"

if [[ "$ACTION" == "--delete" ]]; then
  kubectl delete namespace $NAMESPACE --ignore-not-found
  echo "Namespace $NAMESPACE deleted."
  exit 0
fi

echo "[k8s] Applying manifests..."

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml

kubectl apply -f k8s/infrastructure/postgres.yaml
kubectl apply -f k8s/infrastructure/mongo.yaml
kubectl apply -f k8s/infrastructure/redis.yaml
kubectl apply -f k8s/infrastructure/rabbitmq.yaml

echo "[k8s] Waiting for infrastructure to be ready..."
kubectl rollout status statefulset/postgres  -n $NAMESPACE --timeout=120s
kubectl rollout status statefulset/rabbitmq  -n $NAMESPACE --timeout=120s
kubectl rollout status deployment/redis      -n $NAMESPACE --timeout=60s

kubectl apply -f k8s/ai/whisper.yaml
kubectl apply -f k8s/ai/tts.yaml
kubectl apply -f k8s/ai/livekit.yaml
kubectl apply -f k8s/ai/ollama.yaml

kubectl apply -f k8s/services/auth-service.yaml

echo "[k8s] Waiting for auth-service to be ready..."
kubectl rollout status deployment/auth-service -n $NAMESPACE --timeout=120s

kubectl apply -f k8s/services/patient-service.yaml
kubectl apply -f k8s/services/doctor-service.yaml
kubectl apply -f k8s/services/appointment-service.yaml
kubectl apply -f k8s/services/telemedicine-service.yaml
kubectl apply -f k8s/services/payment-service.yaml
kubectl apply -f k8s/services/notification-service.yaml
kubectl apply -f k8s/services/ai-symptom-service.yaml

kubectl apply -f k8s/gateway/gateway.yaml
kubectl apply -f k8s/jobs/seeder-job.yaml

echo "[k8s] Deployment complete."
echo ""
echo "Access the platform:"
echo "  minikube:  http://\$(minikube ip):30080"
echo "  kind:      kubectl port-forward svc/gateway 8080:80 -n $NAMESPACE"
echo ""
echo "Check status: kubectl get pods -n $NAMESPACE"
