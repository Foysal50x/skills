---
title: Queue Notifications and Mailables, and Send Them After Commit
impact: HIGH
impactDescription: the response stops waiting on SMTP, and nothing sends for a rolled-back write
tags: notifications, mail, queue, transactions
---

## Queue Notifications and Mailables, and Send Them After Commit

A `Notification` or `Mailable` without `ShouldQueue` is delivered inline: the user's request waits for SMTP, Slack or a push provider, and a provider outage becomes a 500 on an action that otherwise succeeded.

Put `ShouldQueue` on the class rather than remembering `Mail::queue()` at each call site — `Mail::send()` and `$user->notify()` then queue it everywhere, including the call sites added later.

Queued delivery inside a transaction has the same race as a job: the worker can pick it up before the commit and read a row that does not exist yet.

**Incorrect (inline delivery, and a mail that goes out for a write that rolls back):**

```php
final class InvoicePaid extends Notification
{
    // no ShouldQueue — the HTTP request pays for the SMTP round trip
}

DB::transaction(function () use ($invoice) {
    $invoice->markPaid();
    $invoice->customer->notify(new InvoicePaid($invoice->id));
});
```

**Correct:**

```php
final class InvoicePaid extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly int $invoiceId)
    {
        $this->afterCommit();
    }
}
```

```php
// Same for a Mailable:
final class StatementReady extends Mailable implements ShouldQueue
{
    use Queueable;
}
```

`afterCommit()` in the constructor covers every call site; `after_commit => true` on the queue connection covers the whole application. Route heavy channels to their own queue with `viaQueues()` so a slow provider cannot delay everything else. See `rules/event-dispatch-after-commit.md`.
