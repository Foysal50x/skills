---
title: Fix the Cause and Preserve the Error
impact: CRITICAL
impactDescription: prevents corrupt writes and retries that hide the failure which must be handled
tags: errors, root-cause, failure, exceptions, correctness
---

## Fix the Cause and Preserve the Error

Correct the condition that makes a failure possible rather than adding a fallback that masks it. Catch an error only to add actionable context or translate it at a defined boundary; never continue to write data after an operation failed or after a failed lookup was silently replaced.

**Incorrect (continues after payment collection failed):**

```php
try {
    $gateway->charge($invoice);
} catch (PaymentException) {
}

$invoice->markPaid();
```

**Correct (the failed operation prevents the invalid write):**

```php
$gateway->charge($invoice);

$invoice->markPaid();
```

Use a context-specific exception when the HTTP or queue boundary needs a deliberate translation; see `laravel-rest-api` and `laravel-async`.
