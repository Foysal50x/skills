---
title: A Service Serves Two or More Actions
impact: HIGH
impactDescription: the only reliable test for "is this Service earned?"
tags: service, reuse, decision
---

## A Service Serves Two or More Actions

A Service is mandatory when the business logic is invoked by two or more Actions, or when it is complex enough that isolating it materially improves testability. Those are the only two triggers.

It is forbidden when the logic is used in exactly one Action.

**Incorrect (single caller wrapped for symmetry):**

```php
// app/Domain/Billing/Services/InvoiceNumberService.php
// Sole caller: IssueInvoiceAction.
final class InvoiceNumberService
{
    public function next(): string { /* ... */ }
}
```

**Correct (two Actions, one decision):**

```php
namespace App\Domain\Billing\Services;

/**
 * Called by RecordUsageAction and IssueInvoiceAction. The proration and
 * tier-boundary rules are worth testing without a use case around them.
 */
final readonly class UsageCalculatorService
{
    public function costFor(TenantId $tenant, DateRange $period): Money
    {
        // one business decision
    }
}
```

Counting callers is the test. If there is one, keep it in the Action — see `rules/action-keep-single-use-logic-inline.md`.
