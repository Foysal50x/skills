---
title: Store UTC, Cast Immutable, Convert at the Edge
impact: MEDIUM-HIGH
impactDescription: prevents off-by-one-day bugs that only appear for some users
tags: dates, timezone, casts, correctness
---

## Store UTC, Cast Immutable, Convert at the Edge

Keep `config('app.timezone')` at `UTC` so every stored timestamp means the same thing. Convert to the user's timezone only when rendering, and back to UTC when accepting input.

Cast dates as `immutable_datetime`. A mutable `Carbon` mutates in place, so `$range->from->addDay()` silently changes the range every other holder of that object can see.

**Incorrect (local timezone stored, mutable date mutated in place):**

```php
// config/app.php
'timezone' => 'Asia/Dhaka',      // now half the rows mean something else

$end = $order->created_at;
$deadline = $end->addDays(7);    // $order->created_at just moved too
```

**Correct:**

```php
// config/app.php
'timezone' => 'UTC',
```

```php
protected function casts(): array
{
    return ['created_at' => 'immutable_datetime', 'expires_at' => 'immutable_datetime'];
}

$deadline = $order->created_at->addDays(7);   // returns a new instance
```

```php
// Edge: accept the user's local day boundaries, store UTC
$from = CarbonImmutable::parse($request->string('from'), $user->timezone)
    ->startOfDay()
    ->utc();
```

A "today" filter computed in UTC for a user in UTC+6 covers the wrong six hours. Resolve the range at the edge and pass a `DateRange` inward.
