---
title: Write an Outbox Row When the Side Effect Must Not Be Lost
impact: HIGH
impactDescription: the side effect commits with the data, or not at all
tags: events, outbox, transactions, delivery, reliability
---

## Write an Outbox Row When the Side Effect Must Not Be Lost

`afterCommit` fixes ordering, not delivery: it holds the dispatch until the commit succeeds, and if the process dies in that window the row is committed and the job never existed. Nobody notices, because nothing failed.

Where losing the effect is unacceptable — a payout instruction, a partner notification, a ledger entry — the intent goes into a table inside the same transaction, and a worker publishes it afterwards. Committed together means never one without the other.

**Incorrect (the write survives, the notification does not):**

```php
$order = DB::transaction(fn (): Order => $this->orders->place($data));

NotifyFulfilmentPartner::dispatch($order->id());   // process dies here and it is simply gone
```

**Correct (intent and data commit together):**

```php
final readonly class PlaceOrderAction
{
    public function __construct(
        private OrderRepositoryInterface $orders,
        private OutboxInterface $outbox,
    ) {}

    public function handle(PlaceOrderData $data): Order
    {
        return DB::transaction(function () use ($data): Order {
            $order = $this->orders->place($data);

            // Same transaction, same fate.
            $this->outbox->record('order.placed', ['order_id' => $order->id()->value]);

            return $order;
        });
    }
}
```

```php
// Scheduled every minute: claim, publish, mark. Re-publishing is safe because
// consumers are idempotent — see rules/job-idempotent-handlers.md.
foreach ($this->outbox->claimUnpublished(limit: 500) as $message) {
    PublishOutboxMessage::dispatch($message->id);
}
```

The outbox buys at-least-once delivery, not exactly-once. Give the consumer a deduplication key, keep the table pruned, and alert on the age of the oldest unpublished row — a stalled relay is invisible otherwise.

For everything else, `->afterCommit()` is the right amount of machinery: see `rules/event-dispatch-after-commit.md`.
