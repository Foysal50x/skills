---
title: Never Import Another Domain's Models, Repositories or Queries
impact: CRITICAL
impactDescription: the one violation that silently merges two bounded contexts
tags: ddd, bounded-context, models, enforcement
---

## Never Import Another Domain's Models, Repositories or Queries

`use App\Domain\<Other>\Models\…`, `…\Repositories\…` and `…\Queries\…` are forbidden across domain boundaries. Cross-boundary data is identities, DTOs and Value Objects only — never another domain's Eloquent Model.

A Model that crosses a boundary drags its relationships, casts, scopes and observers with it. Two contexts that share a Model are one context with extra folders.

**Incorrect (a Model crosses, and with it the whole object graph):**

```php
// Domain/Billing/Listeners/RecordOrderUsage.php
use App\Domain\Orders\Models\Order;

public function handle(OrderPlaced $event): void
{
    $order = Order::with('items.product.supplier')->find($event->orderId);
    UsageRecord::create(['amount' => $order->items->sum('total')]);
}
```

**Correct (identity in, DTO out, own model written):**

```php
// Domain/Orders/Events/OrderPlaced.php — carries identities only
final readonly class OrderPlaced
{
    public function __construct(public TenantId $tenantId, public OrderId $orderId) {}
}

// Domain/Billing/Listeners/RecordOrderUsage.php
final readonly class RecordOrderUsage implements ShouldQueue
{
    public function __construct(private OrderIntegrationInterface $orders) {}

    public function handle(OrderPlaced $event): void
    {
        $summary = $this->orders->orderSummary($event->orderId);   // OrderSummaryDTO

        UsageRecord::create([
            'tenant_id' => $event->tenantId->value,
            'amount' => $summary->total->amount,
        ]);
    }
}
```

Enforce in CI:

```bash
grep -rn 'use App\\Domain\\\([A-Za-z]*\)\\\(Models\|Repositories\|Queries\)' app/Domain \
  | awk -F'app/Domain/' '{split($2,p,"/"); split($0,u,"App\\\\Domain\\\\"); if (p[1] != substr(u[2],1,index(u[2],"\\\\")-1)) print}'
```
