---
title: Invalidate on Write, Not on a Timer
impact: HIGH
impactDescription: users see their own changes immediately
tags: cache, invalidation, observers, events
---

## Invalidate on Write, Not on a Timer

A TTL is a guess about how long stale data is tolerable. Invalidating where the data changes makes the cache correct, and leaves the TTL as a safety net for the case you missed.

Hook `created`, `updated` and `deleted` through a model observer, or — better for cross-domain data — a listener on the Domain Event.

**Incorrect (a five-minute TTL means the user does not see their own edit):**

```php
Cache::remember("merchant:{$id}:settings", 300, fn () => Setting::forMerchant($id));
// User saves settings, refreshes, sees the old values for five minutes.
```

**Correct (observer):**

```php
final class SettingObserver
{
    public function saved(Setting $setting): void
    {
        $this->forget($setting);
    }

    public function deleted(Setting $setting): void
    {
        $this->forget($setting);
    }

    private function forget(Setting $setting): void
    {
        Cache::forget("merchant:{$setting->merchant_id}:settings:v1");
    }
}
```

```php
#[ObservedBy(SettingObserver::class)]
final class Setting extends Model {}
```

Two cautions:

- Bulk `update()` and `upsert()` do **not** fire observers — invalidate explicitly after them (see the `laravel-eloquent` skill).
- For data owned by another domain, listen to that domain's event rather than observing its model.
