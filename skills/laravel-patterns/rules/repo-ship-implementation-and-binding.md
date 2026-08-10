---
title: An Interface Ships With Its Implementation and Its Binding
impact: HIGH
impactDescription: an unbound contract is a guaranteed production 500
tags: repository, contracts, container, binding, completeness
---

## An Interface Ships With Its Implementation and Its Binding

Three things land in the same change or none of them do: the interface in `Contracts/`, one implementation in `Repositories/`, and the binding in a service provider.

An interface with an empty `Repositories/` folder compiles, passes static analysis and looks finished. It fails at runtime — `BindingResolutionException: Target [TodoRepositoryInterface] is not instantiable` — on the first request that injects it, and nothing catches it until someone hits the route. The rule covers every interface under `Contracts/`: integration contracts, ACL ports, notification channels.

**Incorrect (a contract with nothing behind it):**

```php
interface TodoRepositoryInterface
{
    public function paginateForUser(User $user, TodoFilter $filter): LengthAwarePaginator;
}
```

```text
app/Domain/Todo/Repositories/              # empty
app/Providers/DomainServiceProvider.php    # no binding
```

**Correct (contract, implementation and binding together):**

```php
// app/Domain/Todo/Repositories/EloquentTodoRepository.php
final readonly class EloquentTodoRepository implements TodoRepositoryInterface
{
    public function __construct(private OpenTodosQuery $openTodos) {}

    public function paginateForUser(User $user, TodoFilter $filter): LengthAwarePaginator
    {
        return $this->openTodos->handle($user, $filter)->paginate($filter->perPage());
    }
}

// app/Providers/DomainServiceProvider.php
$this->app->bind(TodoRepositoryInterface::class, EloquentTodoRepository::class);

// One test per contract keeps an unbound interface out of production.
expect(app(TodoRepositoryInterface::class))->toBeInstanceOf(EloquentTodoRepository::class);
```

If you cannot name the implementation yet, you have not passed the gate — see `rules/gate-repository-earns-its-name.md` and keep the calls on Eloquent until you can.
