---
name: datadog
description: Monitor infrastructure and applications via Datadog API and CLI. Use when querying metrics, logs, or managing monitors.
metadata:
  category: monitoring
  dependencies:
    cli: curl
    checkCommand: curl --version
  config:
    - name: DD_API_KEY
      label: API Key
      type: secret
      required: true
    - name: DD_APP_KEY
      label: Application Key
      type: secret
      required: true
---

# Datadog

Use the Datadog API to monitor and query.

## API Base
```
https://api.datadoghq.com/api/v1/
https://api.datadoghq.com/api/v2/
```

## Common Operations

### Metrics
- Query metrics: `curl -H "DD-API-KEY: $DD_API_KEY" -H "DD-APPLICATION-KEY: $DD_APP_KEY" "https://api.datadoghq.com/api/v1/query?from=<unix_start>&to=<unix_end>&query=<metric>"`

### Monitors
- List monitors: `curl -H "DD-API-KEY: $DD_API_KEY" -H "DD-APPLICATION-KEY: $DD_APP_KEY" "https://api.datadoghq.com/api/v1/monitor"`
- Mute monitor: `curl -X POST -H "DD-API-KEY: $DD_API_KEY" -H "DD-APPLICATION-KEY: $DD_APP_KEY" "https://api.datadoghq.com/api/v1/monitor/<id>/mute"`

### Logs
- Query logs: `curl -H "DD-API-KEY: $DD_API_KEY" -H "DD-APPLICATION-KEY: $DD_APP_KEY" -H "Content-Type: application/json" -d '{"query":"service:myapp"}' "https://api.datadoghq.com/api/v2/logs/events/search"`

## Notes
- API key from https://app.datadoghq.com/organization-settings/api-keys
- EU site uses `api.datadoghq.eu` instead of `api.datadoghq.com`
