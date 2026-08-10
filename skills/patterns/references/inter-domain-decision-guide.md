# Inter-Domain Communication: Picking the Pattern

Domains are bounded contexts. One domain never references another's internals.

## Surfaces

| Surface | Contents | Visible to other domains |
|---------|----------|--------------------------|
| **Private** | `Models/`, `Repositories/`, `Queries/`, internal `Services/`, `Filters/` internals | Never |
| **Public** | `Contracts/` (interfaces + DTOs), `Events/`, Shared Kernel (`app/Support`, `app/Contracts`) | Yes |

## Choosing

| Need | Pattern | Where it lives |
|------|---------|----------------|
| Both domains share a universal concept (`Money`, `TenantId`, `DateRange`) | **Shared Kernel** | `app/Support/`, `app/Contracts/` |
| "When X happens in A, B reacts" | **Domain Event** | Event in producer's `Events/`, listener in consumer's `Listeners/` |
| "A must synchronously ask or command B" | **Open Host Service** — published contract returning DTOs | Provider's `Contracts/` |
| A consumes an external or untrusted source | **Anti-Corruption Layer** — translator/adapter | Consumer's `ACL/`, or `app/Infrastructure/` |

Prefer the Domain Event. Reach for the Open Host Service only when the caller genuinely needs an answer *now*.

## Hard rules

1. Never `use App\Domain\<Other>\{Models,Repositories,Queries}`.
2. Cross-boundary data is identities, DTOs and Value Objects only — never another domain's Eloquent Model.
3. Events are immutable, past-tense, and carry identity plus minimal data.
4. Listeners touch only their own domain's data. Side-effecting listeners are queued.
5. The Shared Kernel contains no domain behavior, and changes only with cross-domain coordination.
6. A Repository interface returns Models, so it is an *intra*-domain boundary. Cross-domain reads use a separate DTO-returning contract.

## Why a Repository interface is not the cross-domain surface

`OrderRepositoryInterface::pendingOrders(): Collection` returns `Order` models. Handing that to Billing gives Billing an `Order` — with its relationships, casts and scopes — which is exactly what rule 2 forbids. So Orders publishes a second, narrower contract:

```php
interface OrderIntegrationInterface
{
    public function orderSummary(OrderId $id): OrderSummaryDTO;
}
```

Orders implements it using its own repository internally. Billing sees only the DTO.
