---
title: Put the Authorization Decision in authorize()
impact: HIGH
impactDescription: no request reaches the controller unauthorized
tags: authorization, form-request, security
---

## Put the Authorization Decision in authorize()

`authorize()` runs before `rules()` and before the controller. Returning `false` produces a 403 with no further work done. This is the cheapest place to stop a request.

Never leave it as `return true` on an endpoint that touches non-public data — that is the default the generator writes, and it is how endpoints ship unauthorized.

**Incorrect:**

```php
final class UpdateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;      // generator default, never revisited
    }
}
```

**Correct:**

```php
final class UpdateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('order')) ?? false;
    }
}
```

```php
// Creating, where there is no instance yet:
public function authorize(): bool
{
    return $this->user()?->can('create', Order::class) ?? false;
}
```

The `?->` and `?? false` matter: an unauthenticated request has no user, and `null->can()` would be a `TypeError` rather than a 403.
