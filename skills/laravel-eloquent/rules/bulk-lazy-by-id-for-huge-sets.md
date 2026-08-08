---
title: Iterate Huge Sets With lazyById, Not Offsets
impact: MEDIUM
impactDescription: stable iteration while rows are being modified
tags: bulk, lazy, chunk, correctness, memory
---

## Iterate Huge Sets With lazyById, Not Offsets

`chunk()` and `lazy()` page with `LIMIT`/`OFFSET`. If the loop modifies the rows it is reading — the common case in a backfill — the result set shifts and later pages skip records.

`chunkById()` and `lazyById()` page on the primary key instead, so the cursor stays correct no matter what the loop writes.

**Incorrect (each processed batch drops out of the filter, shifting the offset):**

```php
User::where('needs_backfill', true)->chunk(500, function (Collection $users): void {
    $users->each->update(['needs_backfill' => false]);   // silently skips ~half
});
```

**Correct:**

```php
User::query()
    ->where('needs_backfill', true)
    ->chunkById(500, function (Collection $users): void {
        $users->each->update(['needs_backfill' => false]);
    });
```

```php
// LazyCollection when you want collection semantics over the stream:
User::query()
    ->where('needs_backfill', true)
    ->lazyById(500)
    ->each(fn (User $user) => BackfillUser::dispatch($user->id));
```

For a non-integer or non-sequential key, use `chunkById(500, $callback, column: 'uuid', alias: 'uuid')` and make sure that column is indexed and ordered.
