---
title: A Query Class May Write
impact: MEDIUM
impactDescription: gives conditional bulk writes a name and a test
tags: query-class, write, bulk
---

## A Query Class May Write

A write whose main value is the database operation itself — a bulk `update` or `delete` with important conditions — belongs in a Query Class. Same shape as a read: one `handle()`, a business-question name, exposed through the Repository.

If the write is part of a larger business workflow with side effects (dispatching jobs, sending mail, deciding rules), it belongs in an Action that calls the Repository instead.

**Incorrect (conditional bulk write inline in a scheduled command):**

```php
Schedule::call(function (): void {
    Order::where('status', 'pending')
        ->where('created_at', '<=', now()->subHours(2))
        ->update(['status' => 'expired', 'expired_at' => now()]);
})->hourly();
```

**Correct (named, tested, behind the repository):**

```php
final readonly class ExpireAbandonedOrdersQuery
{
    public function handle(CarbonImmutable $expiredBefore): int
    {
        return Order::query()
            ->where('status', OrderStatus::Pending)
            ->where('created_at', '<=', $expiredBefore)
            ->update(['status' => OrderStatus::Expired, 'expired_at' => now()]);
    }
}

// Repository exposes it; the scheduled command calls the repository.
$expired = $orders->expireAbandoned(CarbonImmutable::now()->subHours(2));
```

Note that a bulk `update()` bypasses model events and observers — if listeners must fire, use an Action that iterates, or dispatch the event yourself.
