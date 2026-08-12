---
title: Memoize Repeat Reads Within a Single Request
impact: MEDIUM
impactDescription: collapses the same lookup repeated across one request into one round trip
tags: cache, memoization, performance, request-lifecycle
---

## Memoize Repeat Reads Within a Single Request

A settings lookup, a feature-flag check or a tenant record is read from three services, a middleware and two Blade components. Each read is a Redis round trip for a value that cannot change mid-request. The cache is doing its job; the number of calls is the problem.

`Cache::memo()` keeps the resolved value in memory for the rest of the request or job, and drops it as soon as something writes to that key. `once()` memoizes a computed value that never touches the cache store at all.

**Incorrect (six round trips for one value):**

```php
final readonly class BillingPolicy
{
    public function allows(string $feature): bool
    {
        $plan = Cache::get("tenant:{$this->tenantId}:plan");   // called from five places per request

        return in_array($feature, $plan['features'], true);
    }
}
```

**Correct:**

```php
$plan = Cache::memo()->get("tenant:{$this->tenantId}:plan");        // default store
$plan = Cache::memo('redis')->get("tenant:{$this->tenantId}:plan"); // a named store
```

```php
// No cache store involved — memoized for the life of the object.
public function permissions(): Collection
{
    return once(fn (): Collection => $this->roles->flatMap->permissions->unique());
}
```

`Cache::memo()` is a decorator, not a store: it still reads through to Redis once, and `put()` or `forget()` through it invalidates the in-memory copy. Available in Laravel 13 and recent 12.x releases — check your version before relying on it.

Both are scoped to a lifetime, and the lifetime is longer than you think under Octane, Swoole or a long-lived worker: `once()` lives as long as the object, so a singleton keeps its first answer for the life of the process, and a `memo()` store must be flushed between requests. Reach for either only when the value genuinely cannot change within that window, and never for anything tenant-scoped on a shared instance.
