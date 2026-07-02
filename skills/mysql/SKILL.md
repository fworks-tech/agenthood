---
name: mysql
description: Manage MySQL databases via the mysql CLI. Use when querying, inspecting schema, or managing MySQL databases.
metadata:
  category: databases
  dependencies:
    cli: mysql
    checkCommand: mysql --version
    install:
      darwin: { brew: mysql-client }
      linux: { apt: mysql-client }
      windows: { scoop: mysql }
---

# mysql

Use `mysql` to interact with MySQL databases.

## Common Commands

### Connection
- Connect: `mysql -h <host> -u <user> -p<password> <database>`
- Execute query: `mysql -e "SELECT * FROM table LIMIT 10" <database>`

### Inspection
- List databases: `SHOW DATABASES;`
- List tables: `SHOW TABLES;`
- Describe table: `DESCRIBE <table_name>;`

### Operations
- Execute from file: `mysql <database> < migration.sql`
- Export: `mysqldump -u <user> -p <database> > backup.sql`
- Import: `mysql <database> < backup.sql`

## Notes
- Avoid passing password as command-line argument in shared environments
- Use `~/.my.cnf` for stored credentials
