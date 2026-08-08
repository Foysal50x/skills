---
title: Dispatch Events After the Transaction Commits
impact: HIGH
impactDescription: closes the race between the worker and the commit
tags: events, transactions, race-condition, queues
---

## Dispatch Events After the Transaction Commits

An event dispatched inside a transaction can reach a queued listener before the transaction commits. The listener queries for a row that does not exist yet — or that never will, if the transaction rolls back. The failure rate scales with load, which makes it easy to dismiss as flakiness.

**Incorrect:**

```php
DB::transaction(function () use ($data): void {
    $order = $this->orders->place($data);

    OrderPlaced::dispatch($order->tenantId(), $order->id());   // races the COMMIT
});
```

**Correct (dispatch outside the transaction):**

```php
$order = DB::transaction(fn (): Order => $this->orders->place($data));

OrderPlaced::dispatch($order->tenantId(), $order->id());
```

**Correct (when it must be inside, defer explicitly):**

```php
DB::transaction(function () use ($data): void {
    $order = $this->orders->place($data);

    DB::afterCommit(fn () => OrderPlaced::dispatch($order->tenantId(), $order->id()));
});
```

**Or globally, on the queue connection:**

```php
// config/queue.php
'redis' => [
    // ...
    'after_commit' => true,
],
```

`after_commit` covers queued listeners, queued jobs and queued notifications. It does not defer synchronous listeners — one more reason side-effecting listeners are queued.
