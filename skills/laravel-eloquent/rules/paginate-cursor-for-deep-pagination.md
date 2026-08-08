---
title: Use cursorPaginate for Deep or Fast-Growing Sets
impact: HIGH
impactDescription: constant-time pages instead of degrading OFFSET scans
tags: pagination, cursor, performance
---

## Use cursorPaginate for Deep or Fast-Growing Sets

`OFFSET 100000` makes the database read and discard 100,000 rows. Cursor pagination uses a `WHERE` on the ordering column instead, so page 5,000 costs the same as page 1. It also avoids skipped and repeated rows when the set changes between requests.

The cost: no page numbers, no jumping to an arbitrary page, and the ordering column must be unique (or paired with a unique tiebreaker).

**Incorrect (deep pages, live feed):**

```php
return Message::query()->latest()->paginate(50);   // page 2000 scans 100k rows
```

**Correct:**

```php
return Message::query()
    ->orderBy('created_at', 'desc')
    ->orderBy('id', 'desc')          // tiebreaker keeps the cursor unique
    ->cursorPaginate(50);
```

Choose by need:

| Need | Method |
|------|--------|
| Page numbers and a total count | `paginate()` |
| Prev/next only, moderate depth | `simplePaginate()` |
| Deep pagination, infinite scroll, live feeds | `cursorPaginate()` |
