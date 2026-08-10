---
title: Extend a TTL Without Rewriting the Value
impact: MEDIUM
impactDescription: sliding expiry without a read-modify-write round trip
tags: cache, ttl, laravel-13, sessions
---

## Extend a TTL Without Rewriting the Value

Laravel 13 adds `Cache::touch()`, which extends an existing entry's TTL in place. Before it, a sliding expiry meant reading the value, writing it back with a new TTL — two round trips, a larger payload, and a race between the read and the write.

Laravel 13 only. On Laravel 12, read and re-put.

**Incorrect (read, then write back a value that did not change):**

```php
if ($session = Cache::get("presence:{$userId}")) {
    Cache::put("presence:{$userId}", $session, now()->addMinutes(15));
}
```

**Correct (Laravel 13):**

```php
Cache::touch("presence:{$userId}", now()->addMinutes(15));
```

```php
// Sliding rate-limit window, keeping the counter intact:
Cache::increment($key);
Cache::touch($key, now()->addMinute());
```

Use it for sliding-expiry data — presence, activity windows, soft session state. Do not use it to keep a derived cache alive indefinitely: an entry that never expires and is never invalidated is stale data with extra steps.
