---
name: kubernetes
description: Manage Kubernetes clusters via kubectl. Use when deploying, inspecting, or debugging Kubernetes resources.
metadata:
  category: cloud
  dependencies:
    cli: kubectl
    checkCommand: kubectl version --client
    install:
      darwin: { brew: kubernetes-cli }
      linux: { snap: kubectl, apt: kubectl }
      windows: { scoop: kubectl, choco: kubernetes-cli }
---

# kubectl

Use `kubectl` to interact with Kubernetes clusters.

## Common Commands

### Pods
- List pods: `kubectl get pods`
- Describe pod: `kubectl describe pod <name>`
- Logs: `kubectl logs <pod>`
- Exec into pod: `kubectl exec -it <pod> -- /bin/bash`

### Deployments
- List deployments: `kubectl get deployments`
- Scale: `kubectl scale deployment <name> --replicas=3`
- Rollout status: `kubectl rollout status deployment/<name>`
- Rollback: `kubectl rollout undo deployment/<name>`

### Services
- List services: `kubectl get services`
- Expose: `kubectl expose deployment <name> --port=80 --target-port=8080`

### Context
- Current context: `kubectl config current-context`
- Switch context: `kubectl config use-context <name>`
- List contexts: `kubectl config get-contexts`

## Notes
- Requires `kubectl` installed and `~/.kube/config` configured
- Use `-n <namespace>` to target a specific namespace
