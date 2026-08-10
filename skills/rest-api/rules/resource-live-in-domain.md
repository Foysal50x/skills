---
title: Resources Live With Their Domain
impact: MEDIUM
impactDescription: keeps the domain's public shape next to the domain
tags: resources, layout, ddd
---

## Resources Live With Their Domain

A Resource is the domain's presentation contract, so it belongs in `app/Domain/<Context>/Resources/` next to the models and repositories it serializes — not in a global `app/Http/Resources/` bucket that every domain writes into.

Cross-domain output uses the consuming domain's own Resource over a DTO, never the producing domain's Model.

**Incorrect (one bucket, no boundaries, cross-domain imports invisible):**

```
app/Http/Resources/
    OrderResource.php
    CustomerResource.php
    UsageRecordResource.php
    ConversationResource.php
```

**Correct:**

```
app/Domain/Orders/Resources/
    OrderResource.php
    OrderItemResource.php
app/Domain/Billing/Resources/
    UsageRecordResource.php
app/Domain/Chat/Resources/
    ConversationResource.php
    MessageResource.php
```

```php
namespace App\Domain\Orders\Resources;

final class OrderResource extends JsonResource
{
    // ...
}
```

If two domains need the same output shape, that shape is a DTO in the Shared Kernel or a published contract — see the `laravel-skill:patterns` skill.
