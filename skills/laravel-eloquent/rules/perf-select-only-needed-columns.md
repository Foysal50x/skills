---
title: Select Only the Columns You Use
impact: MEDIUM
impactDescription: cuts row size on wide tables and large pages
tags: performance, select, hydration, memory
---

## Select Only the Columns You Use

Wide tables — those with `TEXT` bodies, serialized payloads or embedding vectors — cost real memory and bandwidth per row. Narrow the `select` when the output does not need every column.

Always include the primary key and any foreign key a relation needs, or the eager load silently fails.

**Incorrect (hydrates a 40-column row, including a 60 KB JSON payload, per result):**

```php
return Order::query()->with('customer')->paginate(50);
```

**Correct:**

```php
return Order::query()
    ->select(['id', 'number', 'status', 'total', 'customer_id', 'created_at'])
    ->with('customer:id,name')     // id required for the match-up
    ->paginate(50);
```

Note the interaction with `preventAccessingMissingAttributes()`: a narrow select plus a Resource reading an unselected column now throws in development instead of returning `null` in production. That is the point.
