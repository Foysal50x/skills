---
title: Lock Expensive Recomputation Against Stampedes
impact: MEDIUM-HIGH
impactDescription: one rebuild instead of two hundred simultaneous ones
tags: cache, locking, stampede, concurrency
---

## Lock Expensive Recomputation Against Stampedes

When a hot key expires, every concurrent request misses at once and all of them run the expensive query. On a busy endpoint that is a self-inflicted load spike at a predictable interval.

`Cache::lock()` lets one request rebuild while the others wait or serve stale. For a cheap approximation, `Cache::flexible()` serves the stale value and refreshes in the background.

**Incorrect (two hundred concurrent rebuilds of the same aggregate):**

```php
return Cache::remember($key, now()->addMinutes(15), fn () => $this->stats->handle($id, $period));
```

**Correct (single-flight with a lock):**

```php
public function statsFor(int $merchantId, DateRange $period): OrderStats
{
    $key = $this->key($merchantId, $period);

    if ($cached = Cache::get($key)) {
        return $cached;
    }

    return Cache::lock("{$key}:rebuild", 30)->block(5, function () use ($key, $merchantId, $period): OrderStats {
        return Cache::remember($key, now()->addMinutes(15), fn (): OrderStats =>
            OrderStats::fromRow($this->stats->handle($merchantId, $period)));
    });
}
```

**Correct (stale-while-revalidate, when slightly stale is acceptable):**

```php
return Cache::flexible($key, [300, 900], fn (): OrderStats => /* ... */);
// Fresh for 5 minutes; between 5 and 15 minutes it returns stale and
// refreshes in the background; after 15 it recomputes synchronously.
```

Locks need an atomic store — Redis, Memcached, DynamoDB or a database store. `block()` throws `LockTimeoutException`; decide whether that is a 503 or a stale read.
