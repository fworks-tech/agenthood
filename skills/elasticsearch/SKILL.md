---
name: elasticsearch
description: Manage Elasticsearch clusters via the REST API. Use when querying, indexing, or managing Elasticsearch indices.
metadata:
  category: databases
  dependencies:
    cli: curl
  config:
    - name: ES_URL
      label: Elasticsearch URL
      type: string
      required: false
      placeholder: http://localhost:9200
---

# Elasticsearch

Use `curl` to interact with Elasticsearch REST API.

## Common Operations

### Cluster
- Health: `curl "${ES_URL:-http://localhost:9200}/_cluster/health"`
- Nodes: `curl "${ES_URL:-http://localhost:9200}/_cat/nodes?v"`
- Indices: `curl "${ES_URL:-http://localhost:9200}/_cat/indices?v"`

### Search
- Basic search: `curl -X POST "${ES_URL}/<index>/_search" -H 'Content-Type: application/json' -d '{"query":{"match":{"field":"value"}}}'`
- Count: `curl "${ES_URL}/<index>/_count"`

### Index Management
- Create index: `curl -X PUT "${ES_URL}/<index>"`
- Delete index: `curl -X DELETE "${ES_URL}/<index>"`
- Index document: `curl -X POST "${ES_URL}/<index>/_doc" -H 'Content-Type: application/json' -d '{"field":"value"}'`

## Notes
- Default port 9200
- Use `?pretty` for formatted JSON output
- Use `/_cat/` endpoints for human-readable output
