---
title: A Service Serves Two or More Actions
impact: HIGH
impactDescription: the only reliable test for "is this Service earned?"
tags: service, reuse, decision
---

## A Service Serves Two or More Actions

Reuse is the default trigger: business logic invoked by two or more Actions belongs in a Service. The one exception is logic complex enough that testing it through its single caller hides the cases that matter — a pricing engine, a proration rule, a state machine.

With one caller and no such complexity, a Service is forbidden. "It might be reused later" is not the exception; name the cases you cannot reach through the Action, or leave it inline.

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

Count callers first. If there is one, keep it in the Action unless you can name the tests the extraction unlocks — see `rules/action-keep-single-use-logic-inline.md` and `rules/gate-service-only-when-reused.md`.
