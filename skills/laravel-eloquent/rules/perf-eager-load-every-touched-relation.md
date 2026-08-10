---
title: Eager-Load Every Relation the Output Touches
impact: CRITICAL
impactDescription: turns N+1 queries into 2
tags: n+1, eager-loading, performance, relations
---

## Eager-Load Every Relation the Output Touches

Any relation accessed while serializing or looping must be in the query's `with([...])`. Use `load()` only when the model is already in hand and the need is conditional.

Because query construction lives in the Query Class, the Query Class owns the eager loads — a Resource that reaches for `$order->customer` depends on `SearchOrdersQuery` having loaded it.

**Incorrect (one query, then one per row, then one per row again):**

```php
final readonly class SearchOrdersQuery
{
    public function handle(OrderQueryFilter $filter): Builder
    {
        return Order::query()->where('status', $filter->status);
    }
}

final class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'customer' => $this->customer->name,          // +1 per order
            'items' => $this->items->count(),             // +1 per order
            'merchant' => $this->merchant->trading_name,  // +1 per order
        ];
    }
}
```

**Correct (loads and counts declared once, in the query):**

```php
return Order::query()
    ->with(['customer:id,name', 'merchant:id,trading_name'])
    ->withCount('items')
    ->where('status', $filter->status);
```

```php
'customer' => $this->customer->name,
'items' => $this->items_count,
```

Nested and conditional loads work the same way: `with(['items.product', 'shipment' => fn ($q) => $q->latest()])`.
