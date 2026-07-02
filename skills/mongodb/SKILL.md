---
name: mongodb
description: Manage MongoDB databases via the mongosh CLI. Use when querying, inspecting, or managing MongoDB collections.
metadata:
  category: databases
  dependencies:
    cli: mongosh
    checkCommand: mongosh --version
    install:
      darwin: { brew: mongosh }
      linux: { apt: mongosh }
      windows: { scoop: mongosh }
---

# mongosh

Use `mongosh` to interact with MongoDB databases.

## Common Commands

### Connection
- Connect: `mongosh "mongodb://localhost:27017"`
- Connect with auth: `mongosh "mongodb://user:pass@host:27017/db"`

### Inspection
- List databases: `show dbs`
- Use database: `use <dbname>`
- List collections: `show collections`

### Queries
- Find documents: `db.collection.find({ field: "value" }).limit(10)`
- Count documents: `db.collection.countDocuments({})`
- Insert: `db.collection.insertOne({ name: "test" })`
- Update: `db.collection.updateOne({ _id: id }, { $set: { field: "value" } })`

## Notes
- Use `mongosh` (new shell) not the deprecated `mongo` shell
- Connection string format: `mongodb://[user:pass@]host[:port]/[db]`
