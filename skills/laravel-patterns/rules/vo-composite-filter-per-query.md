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
final class SearchOrdersRequest extends FormRequest
{
    public function toFilter(): OrderQueryFilter
    {
        return new OrderQueryFilter(
            merchantId: $this->integer('merchant_id') ?: null,
            status: $this->enum('status', OrderStatus::class),
            dateRange: $this->filled('from') || $this->filled('to')
                ? new DateRange($this->date('from')?->toImmutable(), $this->date('to')?->toImmutable())
                : null,
            search: $this->validated('search'),
            sorting: Sorting::tryFromString($this->validated('sort'), Sorting::latest()),
        );
    }
}

// The controller is one line, and the export command builds the same filter from its arguments.
return view('admin.orders.index', ['orders' => $orders->searchOrders($request->toFilter(), perPage: 25)]);
```

The mapping lives in the Form Request, next to the rules that validated the input — not in the controller, where it would run on raw request values. See the `laravel-rest-api` skill's `request-to-dto` rule and `rules/vo-named-constructor-parses-input.md`.

Named arguments keep the call readable as the DTO grows.
