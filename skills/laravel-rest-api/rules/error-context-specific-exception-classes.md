---
title: Raise Context-Specific Exceptions, Never a Bare Exception
impact: MEDIUM-HIGH
impactDescription: hosts catch a type instead of matching on message text
tags: exceptions, errors, domain
---

## Raise Context-Specific Exceptions, Never a Bare Exception

`throw new \Exception('Order already paid')` gives callers nothing to catch except everything, so handling it means matching on the message string — which breaks the moment the wording changes.

Domain exceptions live in `app/Domain/<Context>/Exceptions/`. Only genuinely app-wide exceptions go top level.

**Incorrect:**

```php
throw new \Exception('Subscriber already has a live subscription');

// Caller:
catch (\Exception $e) {
    if (str_contains($e->getMessage(), 'already has a live')) { /* ... */ }
}
```

**Correct:**

```php
namespace App\Domain\Billing\Exceptions;

use RuntimeException;

/**
 * Domain errors raised while moving a subscription through its lifecycle
 * (subscribe, switch, change plan).
 */
class SubscriptionException extends RuntimeException
{
    // named constructors — see rules/error-named-constructors.md
}
```

```php
catch (SubscriptionException $e) { /* one type, no string matching */ }
```

One exception class per lifecycle or concern, with a constructor per failure mode — not one class per failure.
