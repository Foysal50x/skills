---
title: Never Create a Pass-Through Action
impact: HIGH
impactDescription: removes the most common empty layer in a domain
tags: action, repository, reads, simplicity
---

## Never Create a Pass-Through Action

If `handle()` forwards its arguments to one collaborator and returns the result unchanged, the Action is a second name for that collaborator. Delete it; the caller calls the collaborator.

Reads are where this happens most: a list has no use case to orchestrate, so the controller calls the Repository. An Action earns its place when it does at least two of — write state, wrap a transaction, dispatch an event or job, coordinate two collaborators, apply a workflow rule.

**Incorrect (a class whose whole body is a forward):**

```php
final readonly class ListTodosAction
{
    public function __construct(private TodoRepositoryInterface $todos) {}

    public function handle(User $user, TodoFilter $filter): LengthAwarePaginator
    {
        return $this->todos->paginateForUser($user, $filter);
    }
}
```

Two classes, two tests, and the second one asserts that a mock was called.

**Correct (the read goes straight to its Repository; the Action exists where there is a use case):**

```php
final class ListTodosController
{
    public function __invoke(ListTodosRequest $request, TodoRepositoryInterface $todos): AnonymousResourceCollection
    {
        return TodoResource::collection($todos->paginateForUser($request->user(), $request->toFilter()));
    }
}

final readonly class CompleteTodoAction
{
    public function handle(Todo $todo, CarbonImmutable $completedAt): Todo
    {
        return DB::transaction(function () use ($todo, $completedAt): Todo {
            $todo = $this->todos->markCompleted($todo, $completedAt);
            $this->todos->completeSubtasksOf($todo, $completedAt);

            TodoCompleted::dispatch($todo->getKey(), $completedAt);

            return $todo;
        });
    }
}
```

The same test applies to a Service — see `rules/service-not-a-disguised-repository.md`.
