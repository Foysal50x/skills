---
title: Authorize in Exactly One Place per Route
impact: CRITICAL
impactDescription: two checks become two abilities that drift apart
tags: authorization, security, policies, form-request, duplication
---

## Authorize in Exactly One Place per Route

Every route is authorized once. Not zero times, and not twice.

A duplicated check is not extra safety. The two sites name different abilities sooner or later, so whichever runs first decides and the other is decoration — decoration nobody can delete safely, because the route still looks guarded in review.

| The route | Authorize in |
|-----------|--------------|
| has a Form Request | that request's `authorize()` |
| takes no body (DELETE, a POST toggle) | `#[Authorize]` (Laravel 13) or `Gate::authorize()` as the controller's first line |
| shares a rule with its group (tenant membership, subscription) | route middleware, once, on the group |

Two sites are correct only when they check different things — group middleware for membership plus a per-record ownership check. Never the same ability twice.

**Incorrect (two decisions, two different abilities):**

```php
public function authorize(): bool     // ReopenTodoRequest
{
    return $this->user()?->can('update', $this->route('todo')) ?? false;
}

public function __invoke(ReopenTodoRequest $request, Todo $todo): TodoResource
{
    Gate::authorize('complete', $todo);   // second decision, different ability

    return TodoResource::make($this->reopenTodo->handle($todo));
}
```

**Correct (one site — the request, because this route has one):**

```php
public function authorize(): bool     // ReopenTodoRequest
{
    return $this->user()?->can('reopen', $this->route('todo')) ?? false;
}

public function __invoke(ReopenTodoRequest $request, Todo $todo): TodoResource
{
    return TodoResource::make($this->reopenTodo->handle($todo));   // no second check
}
```

With no Form Request, the single site is the controller's first line — `Gate::authorize('delete', $todo);` — and nothing else checks that ability.

A Form Request shared by two routes stays one site — branch inside `authorize()` rather than adding a controller check for the route that has a bound model:

```php
// POST /todos (nothing to own yet) and POST /todos/{todo}/subtasks (owned parent).
return ! ($todo = $this->route('todo')) instanceof Todo || ($this->user()?->can('update', $todo) ?? false);
```

See `rules/authz-check-before-the-domain-runs.md` and `rules/authz-policies-per-model.md`.
