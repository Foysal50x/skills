---
title: Use simplePaginate When the Total Is Not Rendered
impact: MEDIUM-HIGH
impactDescription: removes one COUNT query per request
tags: pagination, performance, count
---

## Use simplePaginate When the Total Is Not Rendered

`paginate()` runs a second query — `SELECT COUNT(*)` over the full filtered set — to build the page count. On a large or heavily filtered table that count is often more expensive than the page itself. If the UI shows only "previous" and "next", you are paying for a number nobody sees.

**Incorrect (count query funding a link nobody clicks):**

```php
// The mobile feed renders "Load more" and nothing else.
return Order::query()->where('merchant_id', $id)->paginate(20);
```

**Correct:**

```php
return Order::query()->where('merchant_id', $id)->simplePaginate(20);
```

`simplePaginate()` fetches `perPage + 1` rows to decide whether a next page exists. Keep `paginate()` where the interface genuinely renders "Page 3 of 47" or a result total.
