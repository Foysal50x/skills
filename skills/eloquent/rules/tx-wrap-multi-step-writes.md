---
title: Wrap Multi-Step Writes in a Transaction
impact: HIGH
impactDescription: prevents half-applied state after a mid-sequence failure
tags: transactions, consistency, writes
---

## Wrap Multi-Step Writes in a Transaction

When one logical change touches more than one row or table, it belongs in `DB::transaction()`. Without it, a failure between statements leaves the database in a state your invariants say is impossible.

`DB::transaction(callable)` commits on return and rolls back on any thrown exception — prefer it over manual `beginTransaction`/`commit`/`rollBack`, which leaks an open transaction on an early return.

**Incorrect (the order is paid, the items are not, and stock is never decremented):**

```php
$order->update(['status' => OrderStatus::Paid]);
$order->items()->update(['paid_at' => now()]);      // throws here
$this->stock->decrement($order->items);
```

**Correct:**

```php
DB::transaction(function () use ($order): void {
    $order->update(['status' => OrderStatus::Paid]);
    $order->items()->update(['paid_at' => now()]);
    $this->stock->decrement($order->items);
});
```

The Action owns the transaction boundary, because the Action knows the extent of the use case. A Repository method should not open one for a single statement.
