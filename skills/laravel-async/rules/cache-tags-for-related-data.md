---
title: Tag Related Entries So One Write Can Clear a Group
impact: MEDIUM-HIGH
impactDescription: invalidate a family of keys without enumerating them
tags: cache, tags, invalidation, redis
---

## Tag Related Entries So One Write Can Clear a Group

When one write invalidates many derived entries — a merchant's dashboard, its filtered lists, its export summaries — enumerating the keys is impossible because the filter combinations are unbounded. Tags let you flush the group.

Tags require a store that supports them: Redis, Memcached or `array`. The `file`, `database` and `dynamodb` stores do not — `Cache::tags()` throws `BadMethodCallException` on those.

**Incorrect (guessing at the key list, and missing most of it):**

```php
Cache::forget("orders:stats:merchant:{$id}:month");
Cache::forget("orders:stats:merchant:{$id}:week");
// ...and the forty filter combinations nobody listed
```

**Correct:**

```php
Cache::tags(['orders', "merchant:{$merchantId}"])->remember(
    $this->key($merchantId, $period),
    now()->addMinutes(15),
    $callback,
);
```

```php
// One write clears everything derived from that merchant's orders:
final class OrderObserver
{
    public function saved(Order $order): void
    {
        Cache::tags(["merchant:{$order->merchant_id}"])->flush();
    }
}
```

Keep tag cardinality low. A tag per row plus a tag per merchant is fine; a tag per filter combination recreates the problem tags were meant to solve. Where tags are unavailable, use a version segment in the key and bump it instead (`rules/cache-stable-key-convention.md`).
