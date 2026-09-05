---
name: api
description: Use when designing, building, or testing REST APIs — endpoint design, authentication, error handling, pagination, versioning, and OpenAPI documentation. Use ONLY when the task involves HTTP API design or implementation, not general networking.
license: MIT
---

# API

## Overview

API is the Society's REST API specialist. It handles endpoint design, authentication patterns, error handling, pagination, versioning, and documentation. API follows the principle that a well-designed API is self-documenting and consistent across all endpoints.

## When to Use

- When designing new REST API endpoints
- When implementing authentication and authorization
- When adding pagination, filtering, or sorting
- When standardizing error responses
- When writing OpenAPI/Swagger documentation
- When reviewing API design for consistency

## Process

### Endpoint Design

1. Use nouns for resources: `/users`, `/orders`, `/items`
2. Use HTTP methods for actions: GET (read), POST (create), PUT/PATCH (update), DELETE (remove)
3. Use plural nouns: `/users/123`, not `/user/123`
4. Nest resources for relationships: `/users/123/orders`
5. Limit nesting depth to 2 levels
6. Use query parameters for filtering: `/users?status=active`

### Authentication

1. Use Bearer tokens (JWT or opaque) in Authorization header
2. Never put tokens in URLs
3. Implement token refresh with short-lived access + long-lived refresh tokens
4. Rate-limit token endpoint separately from API endpoints
5. Return 401 for missing/invalid tokens, 403 for insufficient permissions

### Error Handling

1. Use standard HTTP status codes (200, 201, 400, 401, 403, 404, 422, 500)
2. Return consistent error shape:
   ```json
   {
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "Human-readable description",
       "details": [{"field": "email", "issue": "invalid format"}]
     }
   }
   ```
3. Never expose internal error messages or stack traces
4. Use 422 for validation errors, 400 for malformed requests

### Pagination

1. Use cursor-based pagination for large datasets
2. Return `next_cursor` and `has_more` in response
3. Default page size: 20, max: 100
4. Include `X-Total-Count` header when feasible
5. Support `?page[size]=20&page[after]=cursor` pattern

### Versioning

1. Use URL path versioning: `/v1/users`
2. Never break existing endpoints in a version
3. Deprecate with `Sunset` and `Deprecation` headers
4. Document migration path between versions

## Red Flags

- Using verbs in endpoints: `/getUsers`, `/createOrder`
- Returning different response shapes for success vs error
- Exposing database IDs directly (use UUIDs or slugs)
- Missing rate limiting on public endpoints
- No Content-Type header on responses

## Rationalizations

| What you think | What API knows |
|----------------|---------------|
| "Verbs are clearer" | HTTP methods already express the action. `/users` + GET is clearer than `/getUsers`. |
| "Versioning is overhead" | Breaking changes without versioning is more overhead — you'll lose clients. |
| "I'll add docs later" | Later means never. Design the OpenAPI spec first, implement from it. |
| "Error details help debugging" | They also help attackers. Log details server-side, return safe messages to clients. |

## Verification

Before confirming the change is done:

- [ ] Endpoints use nouns and correct HTTP methods
- [ ] Error responses follow consistent shape
- [ ] Authentication is required on all non-public endpoints
- [ ] Pagination is implemented for list endpoints
- [ ] OpenAPI spec is up to date with implementation
- [ ] Rate limiting exists on public endpoints
- [ ] No sensitive data in error messages or logs
