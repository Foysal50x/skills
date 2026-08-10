---
title: Assert Queued Mail and Notifications With assertQueued()
impact: MEDIUM-HIGH
impactDescription: a passing assertion actually proves the message was dispatched
tags: testing, mail, notifications, queue, fakes
---

## Assert Queued Mail and Notifications With assertQueued()

`Mail::assertSent()` inspects messages sent synchronously. A `Mailable` that implements `ShouldQueue` is never sent that way, so the assertion fails — and the usual reaction is to delete `ShouldQueue` until the test goes green, which puts SMTP back in the request.

Match the assertion to how the message is dispatched: `assertQueued()` for `ShouldQueue`, `assertSent()` for everything else.

**Incorrect (the assertion is wrong, and the class gets "fixed"):**

```php
it('emails the statement', function (): void {
    Mail::fake();

    (new CloseBillingPeriodAction)->handle($account);

    Mail::assertSent(StatementReady::class);   // StatementReady implements ShouldQueue
});
```

**Correct:**

```php
it('queues the statement email', function (): void {
    Mail::fake();
    Notification::fake();

    (new CloseBillingPeriodAction)->handle($account);

    Mail::assertQueued(
        StatementReady::class,
        fn (StatementReady $mail): bool => $mail->hasTo($account->billingEmail),
    );

    Notification::assertSentTo($account->owner, InvoicePaid::class);
});
```

`Notification::fake()` records queued and unqueued notifications alike, so `assertSentTo()` is right either way — the split only affects mail.

Keep content assertions separate: build the mailable directly and use `assertSeeInHtml()` in its own test. A test that asserts both dispatch and wording breaks twice for one copy change.
