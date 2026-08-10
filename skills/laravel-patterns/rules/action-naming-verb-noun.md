---
title: Name Actions Verb + Noun + Action
impact: MEDIUM
impactDescription: makes the use-case inventory readable at a glance
tags: action, naming, convention
---

## Name Actions Verb + Noun + Action

An Action is named `<Verb><Noun>Action` and lives in `app/Domain/<Context>/Actions/`. The directory listing should read as the domain's list of use cases.

Good: `PlaceOrderAction`, `SubmitPromptAction`, `CancelSubscriptionAction`, `RecordUsageAction`.
Bad: `OrderService`, `OrderManager`, `OrderHandler`, `ProcessOrder`, `OrderActions`.

**Incorrect (noun-only, plural, or a manager):**

```php
app/Domain/Orders/Actions/
    OrderActions.php        // several use cases in one file
    OrderManager.php        // says nothing about what it does
    ProcessOrder.php        // "process" is not a use case
```

**Correct (one verb-noun file per use case):**

```php
app/Domain/Orders/Actions/
    PlaceOrderAction.php
    CancelOrderAction.php
    RefundOrderAction.php
    ExpireAbandonedOrdersAction.php
```

An Action that needs a second public method is two Actions. Split it.
