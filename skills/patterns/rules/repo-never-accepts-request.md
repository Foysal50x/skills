---
title: A Repository Never Accepts a Request
impact: HIGH
impactDescription: keeps data access callable outside HTTP
tags: repository, request, dto, boundary
---

## A Repository Never Accepts a Request

Repository (and Query Class) inputs are plain domain values, DTOs or Value Objects. `Illuminate\Http\Request` never crosses the boundary — HTTP mapping stays in the Controller or Form Request.

A Repository that takes a `Request` cannot be called from a console command, a queued job or a test without fabricating one.

**Incorrect:**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(Request $request): LengthAwarePaginator;
}
```

**Correct:**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
}

// Controller builds the filter:
$filter = new OrderQueryFilter(
    merchantId: $request->integer('merchant_id') ?: null,
    status: $request->enum('status', OrderStatus::class),
    dateRange: $dateRange,
);

// Nightly export command builds the same filter from arguments:
$filter = new OrderQueryFilter(dateRange: (new Yesterday())->range());
```

See `rules/vo-composite-filter-per-query.md` for building the filter.
