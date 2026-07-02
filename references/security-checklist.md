# Security Checklist

## Authentication
- [ ] Passwords hashed with bcrypt/scrypt/argon2 (salt rounds >= 12)
- [ ] Session tokens are httpOnly, secure, sameSite
- [ ] Login has rate limiting
- [ ] Password reset tokens expire

## Authorization
- [ ] Every endpoint checks user permissions
- [ ] Users can only access their own resources
- [ ] Admin actions require admin role verification

## Input
- [ ] All user input validated at the boundary
- [ ] SQL queries are parameterized
- [ ] HTML output is encoded/escaped
- [ ] Server-side URL fetches allowlisted (no SSRF)

## Data
- [ ] No secrets in code or version control
- [ ] Sensitive fields excluded from API responses

## Infrastructure
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] CORS restricted to known origins
- [ ] Dependencies audited for vulnerabilities
- [ ] Error messages don't expose internals

## AI/LLM
- [ ] Model output treated as untrusted
- [ ] Secrets kept out of prompts
- [ ] Tool permissions scoped; destructive actions require confirmation
