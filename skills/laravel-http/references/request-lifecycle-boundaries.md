# Edge Layer Boundaries

What each layer at the HTTP edge may touch, and what it must not.

| Layer | May | Must not |
|-------|-----|----------|
| **Route file** | Bind models, group prefixes and names, apply middleware, `scopeBindings()`, `missing()` | Contain closures (breaks `route:cache`), contain business logic |
| **Middleware** | Authenticate, rate-limit, set locale/tenant context, reject early | Query domain tables, mutate domain state |
| **Form Request** | Authorize, validate, normalize input, build the DTO or filter Value Object | Call an Action, write to the database, construct queries |
| **Controller** | Receive the Form Request, call an Action or Repository, shape the response | Build queries, run transactions, dispatch jobs, send mail, hold business rules |
| **Resource** | Read already-loaded attributes and relations, convert to wire types | Trigger a query (guard every relation with `whenLoaded`), decide authorization |
| **Exception handler** | Map exception types to status codes and payloads, report | Contain domain rules |

## The one-way flow

```
Request
  → Middleware            (auth, tenant, rate limit)
  → Form Request          (authorize → normalize → validate → toDto)
  → Controller            (call Action / Repository)
  → Action                (orchestrate the use case)          ← no Request here
  → Repository            (data access)                       ← no Request here
  → Query Class           (query construction)                ← no Request here
  ← domain type
  ← Resource              (wire types)
Response
```

Every arrow pointing inward carries a DTO, a Value Object, a Model or a scalar. Never a `Request`, never `$request->all()`, never `auth()->user()` resolved inside a domain class.

## The test

Can a console command or a queued job run this use case?

```php
// If this is awkward, the boundary is in the wrong place.
$action->handle(new CreateOrderData(customerId: 1, items: [['sku' => 'A1', 'quantity' => 2]]));
```
