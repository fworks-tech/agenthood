---
name: postgres
description: Manage PostgreSQL databases via the psql CLI. Use when querying, inspecting schema, or managing PostgreSQL databases.
metadata:
  category: databases
  dependencies:
    cli: psql
    checkCommand: psql --version
    install:
      darwin: { brew: postgresql }
      linux: { apt: postgresql-client }
      windows: { scoop: postgresql }
---

# psql

Use `psql` to interact with PostgreSQL databases.

## Common Commands

### Connection
- Connect: `psql "postgresql://user:password@host:port/dbname"`
- Connect with env var: `psql "${DATABASE_URL}"`

### Inspection
- List databases: `\l`
- List tables: `\dt`
- Describe table: `\d <table_name>`
- List schemas: `\dn`

### Queries
- Execute query: `psql -c "SELECT * FROM table LIMIT 10" "${DATABASE_URL}"`
- Execute from file: `psql -f migration.sql "${DATABASE_URL}"`
- Quit: `\q`

## Notes
- Requires `psql` installed. Set `DATABASE_URL` environment variable for connection string.
