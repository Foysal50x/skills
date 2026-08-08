---
title: Collapse a Query's Inputs into One Composite Filter
impact: MEDIUM-HIGH
impactDescription: adding a filter stops being a breaking change
tags: value-object, dto, filter, query-class
---

## Collapse a Query's Inputs into One Composite Filter

When a query's inputs grow, bundle them into a domain-specific filter DTO so `handle()` takes a single argument. The DTO lives in `app/Domain/<Context>/Filters/`, composed from shared Value Objects.

The Controller maps `Request` to the DTO. HTTP stays at the edge.

**Incorrect (parameters added one at a time, every caller edited each time):**

```php
public function handle(?int $merchantId, ?OrderStatus $status, ?CarbonImmutable $from, ?CarbonImmutable $to, ?string $search): Builder
```

**Correct:**

```php
namespace App\Domain\Orders\Filters;

final readonly class OrderQueryFilter
{
    public function __construct(
        public ?int $merchantId = null,
        public ?OrderStatus $status = null,
        public ?DateRange $dateRange = null,
        public ?string $search = null,
        public ?Sorting $sorting = null,
    ) {}
}
```

```php
final class OrderIndexController
{
    public function __invoke(Request $request, OrderRepositoryInterface $orders): View
    {
        $dateRange = ($request->filled('from') || $request->filled('to'))
            ? new DateRange($request->date('from')?->toImmutable(), $request->date('to')?->toImmutable())
            : null;

        $filter = new OrderQueryFilter(
            merchantId: $request->integer('merchant_id') ?: null,
            status: $request->enum('status', OrderStatus::class),
            dateRange: $dateRange,
            search: $request->string('search')->trim()->toString() ?: null,
            sorting: $request->filled('sort')
                ? new Sorting($request->string('sort')->toString(), Direction::from($request->string('dir', 'desc')->toString()))
                : null,
        );

        return view('admin.orders.index', ['orders' => $orders->searchOrders($filter, perPage: 25)]);
    }
}
```

Named arguments keep the call readable as the DTO grows.
