---
title: Organize by Domain, Not by Layer
impact: MEDIUM
impactDescription: a feature lives in one folder instead of eight
tags: layout, ddd, structure
---

## Organize by Domain, Not by Layer

Layout is domain-first. Each bounded context owns its Actions, Services, Contracts, Repositories, Queries, Filters, Models, Events and Listeners. Never create top-level `app/Services/`, `app/Repositories/` or `app/Queries/`.

Top-level `app/Support/` (generic Value Objects) and `app/Contracts/` (generic interfaces) are the two permitted exceptions.

**Incorrect (layer-first: one feature scattered across eight folders):**

```
app/
  Services/OrderService.php
  Repositories/OrderRepository.php
  Queries/SearchOrdersQuery.php
  Filters/OrderQueryFilter.php
  Models/Order.php
  Events/OrderPlaced.php
```

**Correct (domain-first):**

```
app/
  Contracts/
    DateRangable.php
  Support/
    Filters/
      Date/DateRange.php
      Date/Presets/{Today,ThisMonth,LastNMonths}.php
      Sorting.php
      Direction.php
  Domain/
    Orders/
      Contracts/OrderRepositoryInterface.php
      Actions/{PlaceOrderAction,CancelOrderAction}.php
      Services/ShippingRateService.php
      Repositories/EloquentOrderRepository.php
      Queries/{SearchOrdersQuery,PendingOrdersQuery,ExpireAbandonedOrdersQuery}.php
      Filters/OrderQueryFilter.php
      Events/OrderPlaced.php
      Resources/OrderResource.php
      Exceptions/OrderException.php
      Models/Order.php
    Billing/
      Actions/RecordUsageAction.php
      Services/UsageCalculatorService.php
      Listeners/RecordOrderUsage.php
```

Full tree and folder meanings: `references/directory-layout.md`.
