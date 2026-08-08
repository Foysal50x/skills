---
title: Keep Repository Interfaces Small
impact: MEDIUM
impactDescription: a wide interface cannot be faked or reimplemented
tags: repository, interface-segregation, contract
---

## Keep Repository Interfaces Small

Aim for fewer than about six methods per interface. A `*RepositoryInterface` with fifteen methods, most used in one or two places, is several interfaces stuck together: it is painful to fake in tests and impossible to reimplement for a new backend.

Split by the question being asked, not by the model.

**Incorrect (one interface for everything Order-shaped):**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(...);
    public function pendingOrders(...);
    public function expireAbandoned(...);
    public function revenueByMonth(...);
    public function topMerchants(...);
    public function exportRows(...);
    public function abandonedCartCount(...);
    public function refundTotals(...);
    // ...
}
```

**Correct (split by concern):**

```php
interface OrderRepositoryInterface        // operational reads and writes
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
    public function pendingOrders(?int $merchantId = null): Collection;
    public function expireAbandoned(CarbonImmutable $expiredBefore): int;
}

interface OrderReportingRepositoryInterface   // dashboard aggregates
{
    public function revenueByMonth(DateRange $period): Collection;
    public function topMerchants(DateRange $period, int $limit = 10): Collection;
}
```

A fake for a three-method interface is five lines. A fake for a fifteen-method one never gets written.
