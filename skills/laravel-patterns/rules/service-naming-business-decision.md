---
title: Name Services After the Business Decision
impact: MEDIUM
impactDescription: a name that describes the decision resists scope creep
tags: service, naming, convention
---

## Name Services After the Business Decision

A Service is named `<Name>Service`, where the name states the *decision it makes*. A name that describes a decision has a natural boundary; a name that describes an entity attracts every method anyone can think of.

Good: `AiProviderRouterService`, `UsageCalculatorService`, `ConversationContextService`, `ProrationService`.
Bad: `OrderService`, `UserService`, `HelperService`, `CommonService`, `BusinessLogicService`.

**Incorrect (entity-named, so it grows without limit):**

```php
final class OrderService
{
    public function create(...) {}
    public function update(...) {}
    public function cancel(...) {}
    public function export(...) {}
    public function notify(...) {}
    public function calculateShipping(...) {}
}
```

**Correct (one decision per Service, plus Actions for the use cases):**

```php
final readonly class ShippingRateService     // decides a rate
final readonly class OrderEligibilityService // decides whether an order may be cancelled

// The verbs live in Actions:
PlaceOrderAction, CancelOrderAction, ExportOrdersAction
```
