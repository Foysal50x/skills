# Cache Invalidation Playbook

## Choosing a strategy

| Situation | Strategy |
|-----------|----------|
| Data changes on a known write path in this domain | **Observer or Action invalidates** the specific key |
| Data changes in another domain | **Listen to that domain's event** and invalidate |
| One write invalidates an unbounded family of keys | **Tags** (`Cache::tags([...])->flush()`) |
| Tags unavailable (`file`, `database` store) | **Version segment** in the key, bumped on write |
| Computation shape changed in a deploy | **Bump the version segment** — invalidates everything at once |
| Data is external and has no write hook | **TTL only**, sized to the staleness you can tolerate |
| Rebuild is expensive and the key is hot | **Lock** (single-flight) or `Cache::flexible()` |

## Key convention

```
{domain}:{entity}:{computation}:v{n}:{scope}:{fingerprint}
orders:stats:v2:merchant:42:a1b2c3d4
```

Every input that changes the result is in the key. Missing the tenant or user segment is how one account sees another's data.

```php
private function key(int $merchantId, DateRange $period): string
{
    $fingerprint = ['from' => $period->from?->toDateString(), 'to' => $period->to?->toDateString()];
    ksort($fingerprint);

    return sprintf('orders:stats:v2:merchant:%d:%s', $merchantId, md5(json_encode($fingerprint, JSON_THROW_ON_ERROR)));
}
```

`ksort()` matters: an unordered array produces a different hash for the same inputs, so the key never hits.

## The three silent failures

1. **Missing scope in the key** — cross-tenant bleed. Audit every key for tenant, user and locale.
2. **Bulk writes skip observers** — `update()`, `delete()`, `upsert()` fire no model events, so nothing invalidates. Flush explicitly after them.
3. **Environment sharing a keyspace** — staging and production on one Redis instance with the same `cache.prefix`. Prefix per environment.

## TTL guidance

| Data | TTL | Also invalidate on |
|------|-----|--------------------|
| Reference data (countries, plans) | Hours to days | Deploy (version bump) |
| Per-tenant settings | Hours | Write (observer) |
| Dashboard aggregates | 5–15 minutes | Write (tags) |
| Permission and role lookups | Minutes | Role change event |
| Rendered fragments | Minutes | Model event on any source |
| External API responses | Seconds to minutes | Nothing — TTL only |

## Verifying an invalidation actually fires

```php
it('clears the merchant stats cache when an order is saved', function (): void {
    $order = Order::factory()->create();
    Cache::tags(["merchant:{$order->merchant_id}"])->put('probe', 'value', 600);

    $order->update(['total' => 500]);

    expect(Cache::tags(["merchant:{$order->merchant_id}"])->get('probe'))->toBeNull();
});
```
