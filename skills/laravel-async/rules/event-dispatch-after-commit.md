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

    // Per dispatch — chain it onto anything queueable:
    GenerateInvoice::dispatch($order->id())->afterCommit();

    // Or defer an arbitrary callback:
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

`after_commit` covers queued jobs, queued event listeners, mailables, notifications and broadcast events, and a rollback discards everything dispatched inside the transaction. It does not defer synchronous listeners — one more reason side-effecting listeners are queued. With it on globally, a dispatch that genuinely must not wait opts out with `->beforeCommit()`.

Per-event rather than per-connection, an event class may implement `Illuminate\Contracts\Events\ShouldDispatchAfterCommit` — the same guarantee, declared where the event is defined. Notifications and mailables use `afterCommit()`; see `rules/event-queue-notifications-and-mailables.md`.

What this does **not** buy is delivery. `afterCommit` only orders the queue write after the commit; if the process dies in that gap the row is committed and the job never existed. Where a lost side effect is unacceptable — a payment capture, a partner notification — write the intent into an outbox table inside the same transaction and let a worker publish it.
