# Member 3 Deployment Pack

This folder contains Kubernetes manifests for Member 3 scope:
- Doctor Service
- Telemedicine Service
- Payment Service

## Files

- `member3-configmap.yaml` - Shared non-secret environment values
- `member3-secrets-template.yaml` - Secret template (replace values before applying)
- `doctor-service.yaml` - Doctor service Deployment + Service
- `telemedicine-service.yaml` - Telemedicine service Deployment + Service
- `payment-service.yaml` - Payment service Deployment + Service

## Prerequisites

1. Build and push service images:
- `doctor-service`
- `telemedicine-service`
- `payment-service`

2. Update image names in each manifest:
- Replace `your-dockerhub-username/...:latest` with your actual registry path.

3. Ensure foundational dependencies exist in cluster:
- PostgreSQL
- RabbitMQ
- Appointment service

## Apply Order

```bash
kubectl apply -f k8s/member3/member3-configmap.yaml
kubectl apply -f k8s/member3/member3-secrets-template.yaml
kubectl apply -f k8s/member3/doctor-service.yaml
kubectl apply -f k8s/member3/telemedicine-service.yaml
kubectl apply -f k8s/member3/payment-service.yaml
```

## Verify

```bash
kubectl get pods
kubectl get svc
kubectl logs deploy/doctor-service
kubectl logs deploy/telemedicine-service
kubectl logs deploy/payment-service
```

## Scope Mapping to Assignment

- Doctor profile + availability: covered by doctor-service APIs.
- Consultation handling + prescriptions: covered by doctor-service APIs.
- Video consultation integration: covered by telemedicine-service (Jitsi integration).
- Payment gateway + confirmations + webhooks: covered by payment-service.
- Event publication: covered by payment-service and telemedicine-service event publishers.

## Notes

- `member3-secrets-template.yaml` is intentionally a template. Do not commit real secrets.
- Payment method storage is currently in-memory for demo flow; production should persist card/token metadata in DB.
