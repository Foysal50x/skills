---
title: Pass Identifiers, Not Object Graphs
impact: HIGH
impactDescription: smaller payloads and no stale state
tags: jobs, serialization, models, correctness
---

## Pass Identifiers, Not Object Graphs

`SerializesModels` stores the key and re-fetches on handle, which is right — but a job constructed with an eagerly-loaded model still serializes the loaded relations into the payload, and a job constructed with a plain array or collection serializes the whole graph.

Pass the identity. Re-fetch what you need inside `handle()`, where the data is current.

**Incorrect (a 400 KB payload carrying data that is stale by the time it runs):**

```php
final class SendOrderConfirmation implements ShouldQueue
{
    public function __construct(
        private readonly Order $order,          // with items, customer, merchant loaded
        private readonly Collection $items,
    ) {}
}
```

**Correct:**

```php
final class SendOrderConfirmation implements ShouldQueue
{
    public function __construct(private readonly int $orderId) {}

    public function handle(OrderRepositoryInterface $orders): void
    {
        $order = $orders->withDetail($this->orderId);   // the repository owns the eager loads

        if ($order === null) {
            return;   // deleted between dispatch and handling — not an error
        }

        Mail::to($order->customer->email)->send(new OrderConfirmation($order));
    }
}
```

Credentials are the strict version of the same rule: they never enter a payload at all, whatever their size — see `rules/job-never-serialize-secrets.md`.

Always handle the missing-row case. Between dispatch and execution the record can be deleted, and `findOrFail()` there means a failed job for something that is not a failure. Alternatively add `#[DeleteWhenMissingModels]` (or `public bool $deleteWhenMissingModels = true`).
