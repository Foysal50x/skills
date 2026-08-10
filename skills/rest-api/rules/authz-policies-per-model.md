---
title: Put the Rule in a Policy, Not in a Conditional
impact: CRITICAL
impactDescription: one definition of "may update" instead of one per call site
tags: authorization, policies, security
---

## Put the Rule in a Policy, Not in a Conditional

Inline ownership checks drift. The controller checks `owner_id`, the Blade view forgets the tenant, and the API endpoint added last month checks neither. A Policy gives the rule one definition that every check shares.

Policies are auto-discovered by naming convention, or bound with `#[UsePolicy]` on the model.

**Incorrect (the same rule, three versions, one of them wrong):**

```php
// Controller
if ($order->merchant_id !== $request->user()->merchant_id) { abort(403); }

// Blade
@if ($order->merchant_id === auth()->user()->merchant_id) ... @endif

// API controller — forgot the archived check
if ($order->merchant_id === auth()->id()) { /* wrong column entirely */ }
```

**Correct:**

```php
final class OrderPolicy
{
    public function view(User $user, Order $order): bool
    {
        return $user->merchant_id === $order->merchant_id;
    }

    public function update(User $user, Order $order): bool
    {
        return $this->view($user, $order) && $order->status === OrderStatus::Pending;
    }
}
```

```php
$this->authorize('update', $order);       // controller
@can('update', $order) ... @endcan        // Blade
$user->can('update', $order);             // anywhere
```

Return `Response::deny('...')` instead of `false` when the user deserves to know why.
