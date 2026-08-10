# The N+1 Playbook

## Find it

| Tool | Use |
|------|-----|
| `Model::preventLazyLoading()` | Throws on the first violation. The only one that stops regressions. |
| Laravel Telescope | Query count and duplicates per request, in development |
| Laravel Debugbar | Same, rendered in the page |
| Laravel Pulse | Slow queries in production |
| `DB::listen()` | Ad-hoc counting in a test or a `tinker` session |

Count queries in a test to lock the fix in place:

```php
it('loads the order list in a constant number of queries', function (): void {
    Order::factory()->count(20)->hasItems(3)->create();

    $queries = 0;
    DB::listen(function () use (&$queries): void { $queries++; });

    $this->getJson('/api/orders')->assertOk();

    expect($queries)->toBeLessThanOrEqual(4);
});
```

## Fix it

| Symptom | Fix |
|---------|-----|
| `$order->customer` inside a loop | `->with('customer')` |
| `$order->items->count()` | `->withCount('items')` |
| `$order->items->isNotEmpty()` | `->withExists('items')` |
| `$order->items->sum('total')` | `->withSum('items', 'total')` |
| `$order->shipments->last()` | `->with(['shipments' => fn ($q) => $q->latest()->limit(1)])` |
| Deep chain `$order->items->product->supplier` | `->with('items.product.supplier')` |
| Polymorphic relation | `->with(['subject' => fn (MorphTo $m) => $m->morphWith([...])])` |
| Model already loaded, relation conditional | `$order->loadMissing('customer')` |
| Only some columns needed | `->with('customer:id,name')` — always include the key |

## Prevent it

1. `Model::shouldBeStrict(! app()->isProduction())` in `AppServiceProvider::boot()`.
2. Eager loads live in the Query Class, next to the filters — not sprinkled at call sites.
3. When a Resource adds a relation, the Query Class that feeds it adds the eager load in the same commit.
4. A query-count assertion on the two or three highest-traffic endpoints.

## The trap

`with()` fixes the loop and leaves a second problem: loading 5,000 parents with 50,000 children into memory. Pair eager loading with pagination (`laravel-skill:eloquent` section 2) or streaming (`rules/perf-chunk-large-result-sets.md`).
