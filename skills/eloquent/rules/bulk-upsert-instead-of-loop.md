---
title: Insert and Upsert in Batches, Not in a Loop
impact: MEDIUM
impactDescription: one round trip instead of one per row
tags: bulk, insert, upsert, performance, import
---

## Insert and Upsert in Batches, Not in a Loop

A loop that calls `create()` or `updateOrCreate()` issues one or two queries per row. For an import of 50,000 rows that is 50,000 round trips, each paying network latency.

`insert()` and `upsert()` write in batches. Batch in chunks of roughly 500 to 1,000 to stay under the driver's placeholder limit.

**Incorrect (100,000 queries for a 50,000-row import):**

```php
foreach ($rows as $row) {
    Product::updateOrCreate(
        ['sku' => $row['sku']],
        ['name' => $row['name'], 'price' => $row['price']],
    );
}
```

**Correct:**

```php
collect($rows)
    ->map(fn (array $row) => [
        'sku' => $row['sku'],
        'name' => $row['name'],
        'price' => $row['price'],
        'updated_at' => now(),
        'created_at' => now(),
    ])
    ->chunk(1000)
    ->each(fn (Collection $chunk) => Product::upsert(
        $chunk->all(),
        uniqueBy: ['sku'],
        update: ['name', 'price', 'updated_at'],
    ));
```

`upsert()` requires a unique or primary index on the `uniqueBy` columns. It does not fire model events — see `rules/bulk-update-bypasses-events.md`.
