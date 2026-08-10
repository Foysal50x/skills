---
title: Close the Relationship Loop With setRelation()
impact: MEDIUM
impactDescription: removes an N+1 that eager loading cannot reach
tags: performance, n-plus-one, relationships, blade
---

## Close the Relationship Loop With setRelation()

`load('items.product')` fills the downward path. The moment a view walks back up — `$item->order->number` — Eloquent fires one query per item for a parent that is already in memory, and `preventLazyLoading()` turns it into an exception rather than a fix.

Hand the parent back to its children explicitly.

**Incorrect (one query per line item for the order you are already holding):**

```php
$order->load('items.product');

// resources/views/orders/show.blade.php
@foreach ($order->items as $item)
    {{ $item->order->number }} — {{ $item->product->name }}
@endforeach
```

**Correct:**

```php
$order->load('items.product');
$order->items->each->setRelation('order', $order);
```

For a collection of parents, do it per parent while the mapping is still known:

```php
$orders = Order::with('items.product')->get();

$orders->each(fn (Order $order) => $order->items->each->setRelation('order', $order));
```

`setRelation()` only sets what is already loaded — it never queries. Do it in the Repository method that loaded the graph, not in the view, so every caller of that method gets the same closed loop.
