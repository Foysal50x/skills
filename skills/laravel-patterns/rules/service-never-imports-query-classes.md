---
title: A Service Never Imports a Query Class
impact: HIGH
impactDescription: keeps one public data-access boundary
tags: service, query-class, boundary
---

## A Service Never Imports a Query Class

For data access, a Service calls **Repository interfaces** for named or complex queries, and may use simple Eloquent or relationship calls for trivial reads. It must never import or instantiate a `*Query` class — those are internal to Repository implementations.

The same prohibition applies to Actions, Jobs, Commands, Controllers and Blade.

**Incorrect (Service reaches into the query layer):**

```php
use App\Domain\Orders\Queries\PendingOrdersQuery;

final readonly class MerchantAlertService
{
    public function __construct(private PendingOrdersQuery $pendingOrders) {}

    public function overdue(int $merchantId): Collection
    {
        return $this->pendingOrders->handle($merchantId)->get();
    }
}
```

**Correct (Service depends on the contract):**

```php
use App\Domain\Orders\Contracts\OrderRepositoryInterface;

final readonly class MerchantAlertService
{
    public function __construct(private OrderRepositoryInterface $orders) {}

    public function overdue(int $merchantId): Collection
    {
        return $this->orders->pendingOrders($merchantId);
    }
}
```

Grep for the violation: `grep -rl 'Queries\\' app --include='*.php' | grep -v '/Repositories/'` must return nothing.
