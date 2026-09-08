---
title: Read Back Through the Consumer Shape
impact: HIGH
impactDescription: prevents writes that appear successful but omit the representation or relation a caller immediately needs
tags: read-model, writes, invariants, resources, consumers
---

## Read Back Through the Consumer Shape

After a write, return or reload the shape the immediate consumer actually reads. Build on an explicit invariant such as a database constraint, model transition or query contract; do not rely on an in-memory model, observer timing or a relation that happened to be loaded.

**Incorrect (returns an instance whose customer relation is incidental):**

```php
$order = Order::create($data);

return new OrderResource($order);
```

**Correct (loads the resource contract explicitly):**

```php
$order = Order::create($data)->load('customer');

return new OrderResource($order);
```

For a multi-step write, use `laravel-eloquent` transactions and dispatch effects through `laravel-async` after commit.
