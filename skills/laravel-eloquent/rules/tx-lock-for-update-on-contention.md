---
title: Lock Rows You Are About to Read and Modify
impact: HIGH
impactDescription: closes the read-modify-write race
tags: transactions, locking, concurrency, race-condition
---

## Lock Rows You Are About to Read and Modify

Reading a value, deciding on it, then writing it back is a race: two concurrent requests both read the old value and both write. `lockForUpdate()` inside a transaction makes the second request wait.

Use `sharedLock()` when you must prevent the row changing while you read but do not intend to write it.

**Incorrect (both requests see stock 1 and both sell it):**

```php
$product = Product::find($id);

if ($product->stock < $quantity) {
    throw StockException::insufficient($product);
}

$product->update(['stock' => $product->stock - $quantity]);
```

**Correct (lock, check, write, all inside one transaction):**

```php
DB::transaction(function () use ($id, $quantity): void {
    $product = Product::query()->whereKey($id)->lockForUpdate()->firstOrFail();

    if ($product->stock < $quantity) {
        throw StockException::insufficient($product);
    }

    $product->decrement('stock', $quantity);
});
```

An atomic `decrement()` alone is safe against lost updates but cannot enforce the "never below zero" check — that needs the lock, or a database constraint.
