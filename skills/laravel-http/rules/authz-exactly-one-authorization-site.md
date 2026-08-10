---
title: Authorize in Exactly One Place per Route
impact: CRITICAL
impactDescription: two checks become two abilities that drift apart
tags: authorization, security, policies, form-request, duplication
---

## Authorize in Exactly One Place per Route

Every route is authorized once. Not zero times, and not twice.

A duplicated check is not "extra safety". The two sites name different abilities sooner or later — a controller calling `Gate::authorize('complete', $todo)` while the Form Request checks `update` means the policy that actually decides the request is whichever runs first, and the other one is decoration. It also makes the check impossible to remove safely: delete either one and the route still looks guarded in review.

Pick the site by what the route has:

| The route | Authorize in |
|-----------|--------------|
| has a Form Request | that request's `authorize()` |
| takes no body (DELETE, a POST toggle) | `#[Authorize]` (Laravel 13) or `Gate::authorize()` as the controller's first line |
| shares a rule with its whole group (tenant membership, active subscription) | route middleware, once, on the group |

Two sites are only correct when they check genuinely different things — group middleware proving tenant membership, plus a per-record ownership check. Never the same ability twice.

**Incorrect (the Form Request authorizes, and the controller authorizes again with a different ability):**

```php
final class ReopenTodoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('todo')) ?? false;
    }
}

final class ReopenTodoController
{
    public function __construct(private readonly ReopenTodoAction $reopenTodo) {}

    public function __invoke(ReopenTodoRequest $request, Todo $todo): TodoResource
    {
        Gate::authorize('complete', $todo);   // second decision, different ability

        return TodoResource::make($this->reopenTodo->handle($todo));
    }
}
```

**Correct (one site — here the request, because the route has one):**

```php
final class ReopenTodoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('reopen', $this->route('todo')) ?? false;
    }
}

final class ReopenTodoController
{
    public function __construct(private readonly ReopenTodoAction $reopenTodo) {}

    public function __invoke(ReopenTodoRequest $request, Todo $todo): TodoResource
    {
        return TodoResource::make($this->reopenTodo->handle($todo));
    }
}
```

**Correct (one site — here the controller, because the route has no body and no Form Request):**

```php
final class DeleteTodoController
{
    public function __invoke(Todo $todo, DeleteTodoAction $action): Response
    {
        Gate::authorize('delete', $todo);

        $action->handle($todo);

        return response()->noContent();
    }
}
```

One Form Request shared by two routes stays one site: keep the check in `authorize()` and branch there, rather than adding a controller check for the route that has a bound model.

```php
// POST /todos (nothing to own yet) and POST /todos/{todo}/subtasks (owned parent).
public function authorize(): bool
{
    $todo = $this->route('todo');

    return ! $todo instanceof Todo || ($this->user()?->can('update', $todo) ?? false);
}
```

See `rules/authz-check-before-the-domain-runs.md` for the timing and `rules/authz-policies-per-model.md` for where the rule itself lives.
