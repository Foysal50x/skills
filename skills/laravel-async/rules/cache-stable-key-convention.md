---
title: Build Cache Keys Deterministically
impact: HIGH
impactDescription: prevents cross-tenant cache bleed and unhittable entries
tags: cache, keys, multi-tenancy, correctness
---

## Build Cache Keys Deterministically

A cache key must include every input that changes the result — tenant, user, locale, filter, version — and must be identical for identical inputs. Two failures follow from getting this wrong: a key missing the tenant serves one tenant's data to another, and a key built from an unordered array never hits.

Adopt a convention: `domain:entity:scope:hash`, with a version segment you can bump to invalidate everything.

**Incorrect (no tenant, unstable hash, unbounded length):**

```php
Cache::remember('orders', 900, fn () => $this->stats->handle($merchantId, $period));
// Every merchant reads merchant #1's numbers.

Cache::remember('orders:'.serialize($filter), 900, $callback);
// Key order depends on how the DTO was constructed → misses.
```

**Correct:**

```php
private function key(int $merchantId, DateRange $period): string
{
    $fingerprint = [
        'from' => $period->from?->toDateString(),
        'to' => $period->to?->toDateString(),
    ];

    ksort($fingerprint);

    return sprintf(
        'orders:stats:v2:merchant:%d:%s',
        $merchantId,
        md5(json_encode($fingerprint, JSON_THROW_ON_ERROR)),
    );
}
```

Bumping `v2` to `v3` invalidates every entry for that computation — the cheapest deploy-time invalidation there is. Prefix per environment (`config('cache.prefix')`) so staging and production never share a Redis instance's keyspace.
