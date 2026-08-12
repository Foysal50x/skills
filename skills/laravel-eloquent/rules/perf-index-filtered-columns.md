---
title: Index the Access Patterns You Filter, Join and Sort By
impact: HIGH
impactDescription: the difference between a seek and a full table scan
tags: performance, indexing, migrations, database
---

## Index the Access Patterns You Filter, Join and Sort By

A Query Class that filters on `merchant_id`, `status` and `created_at` needs those columns indexed. Composite indexes are ordered: put equality columns first, the range column last, and match the order to the query.

Index the access pattern, not the column list: one composite index usually replaces three single-column ones, and a low-cardinality column such as `status` earns nothing on its own. Every index is paid for on every write, so add them from measured queries and drop the ones `EXPLAIN` never picks.

**Incorrect (query written, index forgotten):**

```php
// Query Class
Order::query()
    ->where('merchant_id', $id)
    ->where('status', OrderStatus::Pending)
    ->where('created_at', '>=', $from)
    ->orderBy('created_at', 'desc');

// Migration
Schema::create('orders', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('merchant_id')->constrained();
    $table->string('status');
    $table->timestamps();
});
```

**Correct (index matches the access pattern):**

```php
Schema::create('orders', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('merchant_id')->constrained();
    $table->string('status');
    $table->timestamps();

    // equality, equality, range/sort — in that order. One index, not three:
    // it also serves ('merchant_id') and ('merchant_id', 'status') alone.
    $table->index(['merchant_id', 'status', 'created_at']);
});
```

Verify with `EXPLAIN`, not by eye. An index that is never chosen is write cost with no read benefit — drop it.

A multi-column `ORDER BY` needs a compound index in the same column order — `orderBy('last_name')->orderBy('first_name')` uses `index(['last_name', 'first_name'])` and cannot combine two single-column indexes. The index is declared in the migration that creates the table: see `rules/migration-constrained-foreign-keys.md` for what `constrained()` already indexes for you.
