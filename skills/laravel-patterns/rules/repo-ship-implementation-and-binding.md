---
title: An Interface Ships With Its Implementation and Its Binding
impact: HIGH
impactDescription: an unbound contract is a guaranteed production 500
tags: repository, contracts, container, binding, completeness
---

## An Interface Ships With Its Implementation and Its Binding

A Contract is not a deliverable on its own. Three things land in the same change or none of them do: the interface in `Contracts/`, one implementation in `Repositories/`, and the binding in a service provider.

An interface with an empty `Repositories/` folder compiles, passes static analysis and looks finished. It fails at runtime — `BindingResolutionException: Target [TodoRepositoryInterface] is not instantiable` — on the first request that injects it. Nothing catches it until someone hits the route.

The same rule covers every interface under `Contracts/`: integration contracts, Anti-Corruption Layer ports, notification channels. If you write the method signatures, write the class that satisfies them.

**Incorrect (a contract with nothing behind it):**

```php
// app/Domain/Todo/Contracts/TodoRepositoryInterface.php
interface TodoRepositoryInterface
{
    public function paginateForUser(User $user, TodoFilter $filter): LengthAwarePaginator;

    public function completeSubtasksOf(Todo $parent, CarbonImmutable $completedAt): int;
}
```

```text
app/Domain/Todo/Repositories/     # empty
app/Providers/DomainServiceProvider.php   # no binding
```

**Correct (contract, implementation and binding in one change):**

```php
// app/Domain/Todo/Repositories/EloquentTodoRepository.php
final readonly class EloquentTodoRepository implements TodoRepositoryInterface
{
    public function __construct(private OpenTodosQuery $openTodos) {}

    public function paginateForUser(User $user, TodoFilter $filter): LengthAwarePaginator
    {
        return $this->openTodos->handle($user, $filter)->paginate($filter->perPage());
    }

    public function completeSubtasksOf(Todo $parent, CarbonImmutable $completedAt): int
    {
        return Todo::query()
            ->where('parent_id', $parent->getKey())
            ->whereNull('completed_at')
            ->update(['completed_at' => $completedAt]);
    }
}
```

```php
// app/Providers/DomainServiceProvider.php
public function register(): void
{
    $this->app->bind(TodoRepositoryInterface::class, EloquentTodoRepository::class);
}
```

```php
// One test per contract keeps an unbound interface from reaching production.
it('resolves every domain contract', function () {
    expect(app(TodoRepositoryInterface::class))->toBeInstanceOf(EloquentTodoRepository::class);
});
```

If you cannot name the implementation yet, you have not passed the gate — see `rules/gate-repository-earns-its-name.md` and keep the calls on Eloquent until you can.
