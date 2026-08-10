---
title: Ask exists() When You Only Need a Boolean
impact: MEDIUM
impactDescription: avoids counting or hydrating rows to answer yes/no
tags: performance, exists, count, query
---

## Ask exists() When You Only Need a Boolean

`exists()` stops at the first matching row. `count()` scans them all, and `get()->isNotEmpty()` hydrates them all into models first.

**Incorrect:**

```php
if (Order::where('customer_id', $id)->count() > 0) { /* ... */ }

if (Order::where('customer_id', $id)->get()->isNotEmpty()) { /* ... */ }

if ($customer->orders->count() > 0) { /* loads every order into memory */ }
```

**Correct:**

```php
if (Order::where('customer_id', $id)->exists()) { /* ... */ }

if ($customer->orders()->exists()) { /* relation query, not the collection */ }

// When you genuinely need the number, ask for the number:
$count = $customer->orders()->count();
```

The same distinction applies to `doesntExist()` versus `count() === 0`, and to `withExists()` versus `withCount()` when the output only renders a badge.
