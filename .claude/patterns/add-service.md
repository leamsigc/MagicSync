---
name: add-service
description: Adding a new service class in the db package
triggers:
  - "add service"
  - "create service"
  - "add database query"
edges:
  - target: context/conventions.md
    condition: when checking service pattern requirements
  - target: context/stack.md
    condition: when checking Drizzle ORM usage
  - target: patterns/add-endpoint.md
    condition: when adding endpoint that uses the service
last_updated: 2026-03-30
---

# Add New Service

## Context

Services live in `packages/db/server/services/` and contain all business logic. They are the only place database queries should exist. Services are imported into API routes using the `#layers/BaseDB` alias.

## Steps

1. Create service file in `packages/db/server/services/xxx.service.ts`

2. Implement the service class:
   ```typescript
   import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
   import { myTable } from '#layers/BaseDB/db/schema'
   import type { ServiceResponse } from './types'
   
   export class MyService {
     private db = useDrizzle()
   
     async create(userId: string, data: CreateData): Promise<ServiceResponse<MyType>> {
       try {
         this.validateCreateData(data) // Private validation method
         
         const [result] = await this.db.insert(myTable).values({
           ...data,
           userId,
           createdAt: new Date()
         }).returning()
         
         return { data: result }
       } catch (error) {
         if (error instanceof ValidationError) {
           return { error: error.message, code: error.code }
         }
         return { error: 'Failed to create' }
       }
     }
   
     async findById(id: string): Promise<ServiceResponse<MyType>> {
       const result = await this.db.query.myTable.findFirst({
         where: eq(myTable.id, id)
       })
       
       if (!result) {
         return { error: 'Not found', code: 'NOT_FOUND' }
       }
       return { data: result }
     }
   }
   
   export const myService = new MyService()
   ```

3. Export from `packages/db/server/services/index.ts` (create if needed)

4. Import in API routes:
   ```typescript
   import { myService } from '#layers/BaseDB/server/services/my.service'
   ```

## Gotchas

- Always use Query API (`db.query.table.findFirst`, `db.query.table.findMany`) for reads
- Use raw `db.select()` only for complex aggregations
- Export singleton instance, not the class
- Use `ValidationError` class from `./types` for validation errors
- All service methods return `ServiceResponse<T>`
- Never throw from service methods — return `{ error: string }` instead

## Verify

- [ ] Uses Query API for reads, not raw select
- [ ] Returns `ServiceResponse<T>`, never throws
- [ ] Exported as singleton instance
- [ ] Imported via `#layers/BaseDB` alias
- [ ] Validation on create/update operations

## Debug

**Type errors:**
- Check schema is exported from `packages/db/db/schema.ts`
- Use correct import: `#layers/BaseDB/db/schema`

**Query not working:**
- Check Drizzle relations are defined in schema.ts
- Use `where:` with `eq()`, `and()`, `or()` from drizzle-orm
- For complex queries, check existing services for patterns

