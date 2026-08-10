---
title: Give Each Failure Mode a Named Constructor
impact: MEDIUM-HIGH
impactDescription: call sites read as intent and messages stay consistent
tags: exceptions, errors, api-design
---

## Give Each Failure Mode a Named Constructor

A static named constructor per failure mode puts the message in one place, forces the caller to supply the context the message needs, and makes the throw site read as a statement of what went wrong.

**Incorrect (message assembled at the throw site, differently each time):**

```php
throw new SubscriptionException("Subscriber {$user->id} already has a subscription");
// elsewhere:
throw new SubscriptionException('Already subscribed.');
```

**Correct:**

```php
class SubscriptionException extends RuntimeException
{
    /** subscribe() refuses to create a second live subscription. */
    public static function alreadySubscribed(Subscribable $subscriber): self
    {
        return new self(sprintf(
            'Subscriber (%s #%s) already has a live subscription. Use changePlan(), or cancel first.',
            $subscriber->getSubscriberType(),
            (string) $subscriber->getSubscriberKey(),
        ));
    }

    /** Proration is only meaningful within a single currency. */
    public static function cannotProrateAcrossCurrencies(
        Subscription $subscription,
        string $from,
        string $to,
    ): self {
        return new self(sprintf(
            'Cannot prorate plan change across currencies (%s → %s) for subscription %d; cancel and resubscribe.',
            $from,
            $to,
            $subscription->id,
        ));
    }
}
```

```php
throw SubscriptionException::alreadySubscribed($user);
```

Carry structured context as typed properties when the handler or the log needs it, not only inside the message string.
